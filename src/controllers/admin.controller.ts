import { Controller, Post, Body, HttpException, HttpStatus, Get, Query, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import { AssignDeviceDto } from '../dto/admin.dto';

@Controller('api/admin')
export class AdminController {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  @Post('assign-device')
  async assignDevice(@Body() assignDeviceDto: AssignDeviceDto) {
    try {
      // Check if device exists
      const device = await this.deviceModel.findOne({ deviceId: assignDeviceDto.deviceId });
      if (!device) {
        throw new HttpException('Device not found', HttpStatus.NOT_FOUND);
      }

      // Check if user exists
      const user = await this.userModel.findById(assignDeviceDto.userId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Validate that user and device belong to the same company
      if (user.companyId !== device.companyId) {
        throw new HttpException('User and device must belong to the same company', HttpStatus.BAD_REQUEST);
      }

      // Validate company exists
      const company = await this.companyModel.findById(user.companyId);
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
      }

      // Check if device is already assigned to another user
      const currentAssignedUser = await this.userModel.findOne({ 
        assignedDeviceId: assignDeviceDto.deviceId 
      });

      if (currentAssignedUser && String(currentAssignedUser._id) !== assignDeviceDto.userId) {
        // Unassign from current user
        await this.userModel.updateOne(
          { _id: currentAssignedUser._id },
          { $unset: { assignedDeviceId: 1 } }
        );
      }

      // Assign device to new user
      await this.userModel.updateOne(
        { _id: assignDeviceDto.userId },
        { assignedDeviceId: assignDeviceDto.deviceId }
      );

      // Update device assignment
      await this.deviceModel.updateOne(
        { deviceId: assignDeviceDto.deviceId },
        { assignedTo: assignDeviceDto.userId }
      );

      return {
        ok: true,
        message: 'Device assigned successfully',
        deviceId: assignDeviceDto.deviceId,
        userId: assignDeviceDto.userId,
        companyId: user.companyId
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to assign device', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // List sessions with optional filters. Example: /api/admin/sessions?suspect=true&companyId=...&status=suspect
  @Get('sessions')
  async listSessions(@Query() query: any) {
    try {
      const filter: any = {};

      // Support suspect flag or a status query parameter. Allow comma-separated statuses and case-insensitive values.
      if (query.suspect === 'true') {
        filter.status = 'suspect';
      }

      if (query.status) {
        // Accept comma-separated statuses and normalize values
        const raw = String(query.status || '');
        const parts = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const normalize = (s: string) => {
          if (s === 'active') return 'active';
          if (s === 'loggedout' || s === 'logged_out' || s === 'logged-out') return 'logged_out';
          if (s === 'auto_logged_out' || s === 'autologout' || s === 'auto-logged-out') return 'auto_logged_out';
          if (s === 'expired') return 'expired';
          if (s === 'heartbeat_timeout' || s === 'heartbeat-timeout') return 'heartbeat_timeout';
          if (s === 'suspect') return 'suspect';
          return s; // pass-through unknown values
        };

        const normalized = parts.map(normalize);
        if (normalized.length === 1) filter.status = normalized[0];
        else filter.status = { $in: normalized };
      }

      if (query.companyId) filter.companyId = query.companyId;
      if (query.userId) filter.userId = query.userId;

      const limit = Math.min(parseInt(query.limit || '100', 10), 1000);
      const skip = parseInt(query.skip || '0', 10);

      const sessions = await this.sessionModel.find(filter).sort({ lastHeartbeat: -1 }).skip(skip).limit(limit).lean();
      const count = await this.sessionModel.countDocuments(filter);

      return {
        ok: true,
        count,
        sessions
      };
    } catch (error) {
      throw new HttpException('Failed to list sessions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Resolve a suspect session: restore to active and reset the poor-heartbeat counter
  @Post('session/:id/resolve')
  async resolveSession(@Param('id') id: string, @Body() body: any) {
    try {
      const session = await this.sessionModel.findById(id);
      if (!session) throw new HttpException('Session not found', HttpStatus.NOT_FOUND);

      await this.sessionModel.updateOne({ _id: id }, { $set: { status: 'active', consecutivePoorHeartbeats: 0 } });

      return { ok: true, message: 'Session restored to active', sessionId: id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to resolve session', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Force logout a session (mark auto_logged_out and set logoutAt)
  @Post('session/:id/logout')
  async forceLogoutSession(@Param('id') id: string, @Body() body: any) {
    try {
      const session = await this.sessionModel.findById(id);
      if (!session) throw new HttpException('Session not found', HttpStatus.NOT_FOUND);

      await this.sessionModel.updateOne({ _id: id }, { $set: { status: 'auto_logged_out', logoutAt: new Date() } });

      return { ok: true, message: 'Session force-logged out', sessionId: id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to force logout session', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}