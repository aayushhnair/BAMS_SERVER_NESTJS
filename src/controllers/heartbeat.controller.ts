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
        throw new HttpException('Session not found', HttpStatus.UNAUTHORIZED);
      }

      if (session.deviceId !== heartbeatDto.deviceId) {
        throw new HttpException('Device mismatch', HttpStatus.FORBIDDEN);
      }

      if (session.status !== 'active') {
        throw new HttpException('Session not active', HttpStatus.UNAUTHORIZED);
      }

      // Check if session has expired based on SESSION_TIMEOUT_HOURS
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
        throw new HttpException('Session expired', HttpStatus.UNAUTHORIZED);
      }

      // Update session heartbeat
      await this.sessionModel.updateOne(
        { _id: heartbeatDto.sessionId },
        { lastHeartbeat: new Date() }
      );

      // Update device lastSeen
      await this.deviceModel.updateOne(
        { deviceId: heartbeatDto.deviceId },
        { lastSeen: new Date() }
      );

      return { ok: true, message: 'Heartbeat updated' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Heartbeat failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}