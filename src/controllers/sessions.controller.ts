import { Controller, Get, Query, HttpException, HttpStatus, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { User, UserDocument } from '../schemas/user.schema';
import type { Response } from 'express';

@Controller('api')
export class SessionsController {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  @Get('sessions')
  async getSessions(
    @Query('companyId') companyId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    try {
      const filter: any = {};
      
      if (companyId) filter.companyId = companyId;
      if (userId) filter.userId = userId;
      
      if (from || to) {
        filter.loginAt = {};
        if (from) filter.loginAt.$gte = new Date(from);
        if (to) filter.loginAt.$lte = new Date(to);
      }

      const sessions = await this.sessionModel.find(filter).sort({ loginAt: -1 });

      // Get user details for display names
      const userIds = [...new Set(sessions.map(s => s.userId))];
      const users = await this.userModel.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [String(u._id), u]));

      return {
        ok: true,
        sessions: sessions.map(session => ({
          sessionId: session._id,
          companyId: session.companyId,
          userId: session.userId,
          userDisplayName: userMap.get(session.userId)?.displayName || 'Unknown',
          deviceId: session.deviceId,
          loginAt: session.loginAt,
          logoutAt: session.logoutAt,
          status: session.status,
          lastHeartbeat: session.lastHeartbeat,
          loginLocation: {
            lat: session.loginLocation.coordinates[1],
            lon: session.loginLocation.coordinates[0],
            accuracy: session.loginLocation.accuracy
          }
        }))
      };
    } catch (error) {
      throw new HttpException('Failed to fetch sessions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('export')
  async exportSessions(
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format: string = 'csv',
    @Res() res?: Response,
  ) {
    try {
      const filter: any = {};
      
      if (companyId) filter.companyId = companyId;
      
      if (from || to) {
        filter.loginAt = {};
        if (from) filter.loginAt.$gte = new Date(from);
        if (to) filter.loginAt.$lte = new Date(to);
      }

      const sessions = await this.sessionModel.find(filter).sort({ loginAt: -1 });

      // Get user details
      const userIds = [...new Set(sessions.map(s => s.userId))];
      const users = await this.userModel.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [String(u._id), u]));

      if (format === 'csv') {
        const csvHeader = 'SessionId,CompanyId,UserId,UserDisplayName,DeviceId,LoginAt,LogoutAt,Status,LastHeartbeat,LoginLat,LoginLon,LoginAccuracy\n';
        const csvRows = sessions.map(session => {
          const user = userMap.get(session.userId);
          return [
            session._id,
            session.companyId,
            session.userId,
            user?.displayName || 'Unknown',
            session.deviceId,
            session.loginAt?.toISOString() || '',
            session.logoutAt?.toISOString() || '',
            session.status,
            session.lastHeartbeat?.toISOString() || '',
            session.loginLocation.coordinates[1],
            session.loginLocation.coordinates[0],
            session.loginLocation.accuracy
          ].map(field => `"${field || ''}"`).join(',');
        }).join('\n');

        const csvContent = csvHeader + csvRows;

        if (res) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="sessions_export_${new Date().toISOString().split('T')[0]}.csv"`);
          return res.send(csvContent);
        }
        
        return { ok: true, data: csvContent };
      }

      // Default JSON format
      return {
        ok: true,
        sessions: sessions.map(session => ({
          sessionId: session._id,
          companyId: session.companyId,
          userId: session.userId,
          userDisplayName: userMap.get(session.userId)?.displayName || 'Unknown',
          deviceId: session.deviceId,
          loginAt: session.loginAt,
          logoutAt: session.logoutAt,
          status: session.status,
          lastHeartbeat: session.lastHeartbeat,
          loginLocation: {
            lat: session.loginLocation.coordinates[1],
            lon: session.loginLocation.coordinates[0],
            accuracy: session.loginLocation.accuracy
          }
        }))
      };
    } catch (error) {
      throw new HttpException('Failed to export sessions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}