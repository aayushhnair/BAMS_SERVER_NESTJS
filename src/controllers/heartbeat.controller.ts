import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { HeartbeatDto } from '../dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Controller('api')
export class HeartbeatController {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    private configService: ConfigService,
  ) {}

  @Post('heartbeat')
  async heartbeat(@Body() heartbeatDto: HeartbeatDto) {
    try {
      const session = await this.sessionModel.findById(heartbeatDto.sessionId);
      
      if (!session) {
        throw new HttpException({
          message: 'Session not found. Please login again.',
          error: 'SESSION_NOT_FOUND',
          login_status: false
        }, HttpStatus.UNAUTHORIZED);
      }

      if (session.deviceId !== heartbeatDto.deviceId) {
        throw new HttpException({
          message: 'Device mismatch detected. Please login again from the correct device.',
          error: 'DEVICE_MISMATCH',
          login_status: false
        }, HttpStatus.FORBIDDEN);
      }

      if (session.status !== 'active') {
        throw new HttpException({
          message: `Your session is ${session.status}. Please login again.`,
          error: 'SESSION_NOT_ACTIVE',
          sessionStatus: session.status,
          login_status: false
        }, HttpStatus.UNAUTHORIZED);
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
        throw new HttpException({
          message: `Your session has exceeded the maximum duration of ${sessionTimeoutHours} hours. Please login again.`,
          error: 'SESSION_EXPIRED',
          maxDurationHours: sessionTimeoutHours,
          login_status: false
        }, HttpStatus.UNAUTHORIZED);
      }

      // Check if too much time has passed since last heartbeat (heartbeat timeout)
      const heartbeatTimeoutMinutes = this.configService.get<number>('heartbeatIntervalMinutes') || 5;
      const heartbeatTimeoutMs = heartbeatTimeoutMinutes * 60 * 1000;
      const timeSinceLastHeartbeat = Date.now() - session.lastHeartbeat.getTime();

      if (timeSinceLastHeartbeat > heartbeatTimeoutMs * 2) {
        // Heartbeat gap is too large - auto-logout for security
        await this.sessionModel.updateOne(
          { _id: heartbeatDto.sessionId },
          { 
            logoutAt: new Date(),
            status: 'heartbeat_timeout'
          }
        );
        throw new HttpException({
          message: `Your session timed out due to inactivity (no heartbeat for ${Math.floor(timeSinceLastHeartbeat / 60000)} minutes). Please login again.`,
          error: 'HEARTBEAT_TIMEOUT',
          inactiveMinutes: Math.floor(timeSinceLastHeartbeat / 60000),
          expectedIntervalMinutes: heartbeatTimeoutMinutes,
          login_status: false
        }, HttpStatus.UNAUTHORIZED);
      }

      // Update session heartbeat
      const currentTime = new Date();
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
        message: 'Heartbeat updated successfully',
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