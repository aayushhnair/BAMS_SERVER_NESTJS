import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { HeartbeatDto } from '../dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { MESSAGES } from '../constants/messages';
import { User, UserDocument } from '../schemas/user.schema';
import { Location, LocationDocument } from '../schemas/location.schema';
import { isWithinAllocatedLocation, isWithinAllowedLocation } from '../utils/location.utils';

@Controller('api')
export class HeartbeatController {
  private readonly logger = new Logger(HeartbeatController.name);
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    private configService: ConfigService,
  ) {}

  @Post('heartbeat')
  async heartbeat(@Body() heartbeatDto: HeartbeatDto) {
    try {
      const session = await this.sessionModel.findById(heartbeatDto.sessionId);
      
      if (!session) {
        const msg = MESSAGES.AUTH.SESSION_NOT_FOUND;
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          login_status: false
        }, msg.status);
      }

      if (session.deviceId !== heartbeatDto.deviceId) {
        const msg = MESSAGES.HEARTBEAT.DEVICE_MISMATCH;
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          login_status: false
        }, msg.status);
      }

      if (session.status !== 'active') {
        const msg = MESSAGES.HEARTBEAT.SESSION_NOT_ACTIVE(session.status);
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          sessionStatus: session.status,
          login_status: false
        }, msg.status);
      }

      // Check if session has exceeded maximum duration (SESSION_TIMEOUT_HOURS)
      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 8;
      const sessionAgeMs = Date.now() - session.loginAt.getTime();
      const sessionAgeHours = sessionAgeMs / (1000 * 60 * 60);

  if (sessionAgeHours > sessionTimeoutHours) {
        // Auto-expire the session
        await this.sessionModel.updateOne(
          { _id: heartbeatDto.sessionId },
          { 
            logoutAt: new Date(),
            status: 'expired'
          }
        );
        const msg = MESSAGES.HEARTBEAT.SESSION_EXPIRED(sessionTimeoutHours);
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          maxDurationHours: sessionTimeoutHours,
          login_status: false
        }, msg.status);
      }

      // Check if too much time has passed since last heartbeat (heartbeat timeout)
      const heartbeatTimeoutMinutes = this.configService.get<number>('heartbeatMinutes') || 5;
      const heartbeatGraceFactor = this.configService.get<number>('heartbeatGraceFactor') || 2;
      // Allowed interval (in minutes) = heartbeatMinutes * heartbeatGraceFactor
      const allowedIntervalMinutes = heartbeatTimeoutMinutes * heartbeatGraceFactor;
      const heartbeatTimeoutMs = allowedIntervalMinutes * 60 * 1000;
      // Defensive null-check for lastHeartbeat
      const lastHb = session.lastHeartbeat;
      if (!lastHb) {
        // No heartbeat recorded - consider session stale and auto-logout
        await this.sessionModel.updateOne(
          { _id: heartbeatDto.sessionId },
          {
            logoutAt: new Date(),
            status: 'heartbeat_timeout'
          }
        );
        this.logger.warn(`Heartbeat: session ${heartbeatDto.sessionId} missing lastHeartbeat, auto-logged out`, { sessionId: String(session._id), deviceId: session.deviceId, userId: session.userId });
        const msg = MESSAGES.HEARTBEAT.HEARTBEAT_TIMEOUT(0, heartbeatTimeoutMinutes * heartbeatGraceFactor);
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          inactiveMinutes: msg.inactiveMinutes,
          expectedIntervalMinutes: msg.expectedIntervalMinutes,
          login_status: false
        }, msg.status);
      }

      const timeSinceLastHeartbeat = Date.now() - lastHb.getTime();

      if (timeSinceLastHeartbeat > heartbeatTimeoutMs) {
        // Heartbeat gap is too large - auto-logout for security
        await this.sessionModel.updateOne(
          { _id: heartbeatDto.sessionId },
          { 
            logoutAt: new Date(),
            status: 'heartbeat_timeout'
          }
        );
        const inactiveMinutes = Math.floor(timeSinceLastHeartbeat / 60000);
        // Log structured details to help triage which device/user caused the timeout
        this.logger.warn(`Heartbeat timeout for session ${heartbeatDto.sessionId}`, { sessionId: String(session._id), userId: session.userId, deviceId: session.deviceId, inactiveMinutes });
        const msg = MESSAGES.HEARTBEAT.HEARTBEAT_TIMEOUT(inactiveMinutes, allowedIntervalMinutes);
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          inactiveMinutes: msg.inactiveMinutes,
          expectedIntervalMinutes: msg.expectedIntervalMinutes,
          login_status: false
        }, msg.status);
      }

      // Update session heartbeat
      const currentTime = new Date();

      // Location validation for heartbeat: only enforce for non-admins and when
      // either the client requested location validation or the user requires it.
      const user = await this.userModel.findById(session.userId);
      if (!user) {
        const msg = MESSAGES.AUTH.SESSION_NOT_FOUND;
        throw new HttpException({
          message: msg.message,
          error: msg.error,
          login_status: false
        }, msg.status);
      }

      if (user.role !== 'admin') {
        // Determine whether to validate location for this heartbeat
        const reqFlag = heartbeatDto.location && (heartbeatDto.location as any).location_Status;
        const doLocationValidation = reqFlag === true ? true : (reqFlag === false ? false : (user.locationValidationRequired !== false));

        if (doLocationValidation) {
          const hbLoc = { lat: heartbeatDto.location.lat, lon: heartbeatDto.location.lon, accuracy: heartbeatDto.location.accuracy };
          const proximityMeters = this.configService.get<number>('locationProximityMeters') || 100;
          // Use the same proximityMeters as the heartbeat accuracy threshold per request
          const maxAccuracy = proximityMeters;

          // If accuracy is poor, increment consecutivePoorHeartbeats and skip location validation for this heartbeat.
          if (hbLoc.accuracy && hbLoc.accuracy > maxAccuracy) {
            const updated = await this.sessionModel.findByIdAndUpdate(
              session._id,
              { $inc: { consecutivePoorHeartbeats: 1 } },
              { new: true }
            );
            const counter = (updated && (updated as any).consecutivePoorHeartbeats) || 0;
            this.logger.warn(`Heartbeat location accuracy too poor for session ${heartbeatDto.sessionId}`, { sessionId: heartbeatDto.sessionId, accuracy: hbLoc.accuracy, maxAccuracy, consecutivePoorHeartbeats: counter });

            // If threshold exceeded, mark session as suspect for admin review (do not auto-logout immediately)
            const POOR_THRESHOLD = 6; // configurable choice per request
            if (counter >= POOR_THRESHOLD) {
              await this.sessionModel.updateOne({ _id: session._id }, { status: 'suspect' });
              // update lastHeartbeat and device lastSeen so admin has recent info
              await this.sessionModel.updateOne({ _id: session._id }, { lastHeartbeat: currentTime });
              await this.deviceModel.updateOne({ deviceId: heartbeatDto.deviceId }, { lastSeen: currentTime });
              return {
                ok: true,
                login_status: true,
                message: 'Heartbeat received but GPS accuracy poor; session marked suspect after multiple poor readings',
                suspect: true,
                consecutivePoorHeartbeats: counter,
                sessionId: session._id,
                lastHeartbeat: currentTime.toISOString()
              };
            }

            // Otherwise, accept heartbeat but skip location checks for this heartbeat
            await this.sessionModel.updateOne({ _id: session._id }, { lastHeartbeat: currentTime });
            await this.deviceModel.updateOne({ deviceId: heartbeatDto.deviceId }, { lastSeen: currentTime });
            return {
              ok: true,
              login_status: true,
              message: 'Heartbeat accepted; GPS accuracy poor so location validation skipped for this heartbeat',
              consecutivePoorHeartbeats: counter,
              sessionId: session._id,
              lastHeartbeat: currentTime.toISOString()
            };
          }

          // Good accuracy: reset consecutive poor counter and, if previously marked suspect, restore active status
          const resetUpdate: any = { consecutivePoorHeartbeats: 0 };
          if ((session as any).status === 'suspect') resetUpdate.status = 'active';
          if (Object.keys(resetUpdate).length > 0) {
            await this.sessionModel.updateOne({ _id: session._id }, { $set: resetUpdate });
            if (resetUpdate.status) this.logger.log(`Session ${session._id} restored to active after receiving good GPS accuracy`);
          }

          if (user.allocatedLocationId) {
            const allocatedLocation = await this.locationModel.findById(user.allocatedLocationId);
            if (!allocatedLocation) {
              const msg = MESSAGES.LOCATION.ALLOCATED_LOCATION_NOT_FOUND;
              throw new HttpException({ message: msg.message, error: msg.error }, msg.status);
            }

            if (!isWithinAllocatedLocation(hbLoc, allocatedLocation, proximityMeters)) {
              this.logger.warn(`Heartbeat outside allocated location for session ${heartbeatDto.sessionId}`, { sessionId: heartbeatDto.sessionId, userId: user._id, deviceId: heartbeatDto.deviceId });
              const msg = MESSAGES.LOCATION.NOT_WITHIN_ALLOCATED_LOCATION(allocatedLocation.name, proximityMeters);
              throw new HttpException({ message: msg.message, error: msg.error }, msg.status);
            }
          } else {
            const allowedLocations = await this.locationModel.find({ companyId: user.companyId });
            if (!isWithinAllowedLocation(hbLoc, allowedLocations)) {
              this.logger.warn(`Heartbeat outside company locations for session ${heartbeatDto.sessionId}`, { sessionId: heartbeatDto.sessionId, userId: user._id, deviceId: heartbeatDto.deviceId });
              const msg = MESSAGES.LOCATION.LOCATION_NOT_ALLOWED;
              throw new HttpException({ message: msg.message, error: msg.error }, msg.status);
            }
          }
        }
      }
      await this.sessionModel.updateOne(
        { _id: heartbeatDto.sessionId },
        { lastHeartbeat: currentTime }
      );

      // Update device lastSeen
      await this.deviceModel.updateOne(
        { deviceId: heartbeatDto.deviceId },
        { lastSeen: currentTime }
      );

      return { 
        ok: true, 
        login_status: true,
        message: MESSAGES.HEARTBEAT.UPDATED.message,
        sessionId: heartbeatDto.sessionId,
        lastHeartbeat: currentTime.toISOString()
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException({
        message: 'Heartbeat update failed. Please try again.',
        error: 'HEARTBEAT_FAILED',
        login_status: false
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}