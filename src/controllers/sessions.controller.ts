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
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
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

      // Pagination
      const skipCount = skip ? parseInt(skip, 10) : 0;
      const limitCount = limit ? parseInt(limit, 10) : 100; // Default limit 100

      // Get total count for pagination metadata
      const totalCount = await this.sessionModel.countDocuments(filter);

      const sessions = await this.sessionModel
        .find(filter)
        .sort({ loginAt: -1 })
        .skip(skipCount)
        .limit(limitCount);

      // Get user details for display names
      const userIds = [...new Set(sessions.map(s => s.userId))];
      const users = await this.userModel.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [String(u._id), u]));

      return {
        ok: true,
        total: totalCount,
        skip: skipCount,
        limit: limitCount,
        count: sessions.length,
        sessions: sessions.map(session => {
          const user = userMap.get(session.userId);
          
          // Calculate work hours
          let workingHours = 0;
          let workingMinutes = 0;
          if (session.loginAt && session.logoutAt) {
            const duration = new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime();
            workingMinutes = Math.floor(duration / 60000);
            workingHours = parseFloat((workingMinutes / 60).toFixed(2));
          }

          return {
            sessionId: session._id,
            companyId: session.companyId,
            userId: session.userId,
            username: user?.username || 'unknown',
            userDisplayName: user?.displayName || 'Unknown',
            deviceId: session.deviceId,
            loginAt: session.loginAt,
            logoutAt: session.logoutAt,
            workingHours,
            workingMinutes,
            status: session.status,
            lastHeartbeat: session.lastHeartbeat,
            loginLocation: session.loginLocation ? {
              lat: session.loginLocation.coordinates[1],
              lon: session.loginLocation.coordinates[0],
              accuracy: session.loginLocation.accuracy
            } : null,
            logoutLocation: session['logoutLocation'] ? {
              lat: session['logoutLocation'].coordinates[1],
              lon: session['logoutLocation'].coordinates[0],
              accuracy: session['logoutLocation'].accuracy
            } : null
          };
        })
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
  /**
   * User-specific work report API
   * GET /api/user-work-report?userId=...&type=daily|weekly|monthly|yearly
   * Returns work hours and session details for the specified user and period
   */
  @Get('user-work-report')
  async getUserWorkReport(
    @Query('userId') userId: string,
    @Query('type') type: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    @Query('date') date?: string // Optional, defaults to today
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    // Determine date range based on type
    const now = date ? new Date(date) : new Date();
    let from: Date, to: Date;
    switch (type) {
      case 'daily':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'weekly': {
        const day = now.getDay();
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7);
        break;
      }
      case 'monthly':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'yearly':
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        throw new HttpException('Invalid type', HttpStatus.BAD_REQUEST);
    }
    // Query sessions for user in date range
    const sessions = await this.sessionModel.find({
      userId,
      loginAt: { $gte: from, $lt: to }
    }).sort({ loginAt: 1 });
    // Calculate total work hours
    let totalMinutes = 0;
    const sessionDetails = sessions.map(session => {
      let workingMinutes = 0;
      if (session.loginAt && session.logoutAt) {
        workingMinutes = Math.floor((new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime()) / 60000);
        totalMinutes += workingMinutes;
      }
      return {
        sessionId: session._id,
        loginAt: session.loginAt,
        logoutAt: session.logoutAt,
        workingMinutes,
        status: session.status
      };
    });
    // Get user info
    const user = await this.userModel.findById(userId);
    return {
      ok: true,
      user: user ? { userId: user._id, username: user.username, displayName: user.displayName } : null,
      type,
      from,
      to,
      totalSessions: sessions.length,
      totalWorkingMinutes: totalMinutes,
      totalWorkingHours: parseFloat((totalMinutes / 60).toFixed(2)),
      sessions: sessionDetails
    };
  }

  /**
   * Export user-specific work report as CSV
   * GET /api/user-work-report/export?userId=...&type=daily|weekly|monthly|yearly&date=...
   */
  @Get('user-work-report/export')
  async exportUserWorkReport(
    @Query('userId') userId: string,
    @Query('type') type: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    @Query('date') date?: string,
    @Res() res?: Response,
  ) {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      // Determine date range based on type
      const now = date ? new Date(date) : new Date();
      let from: Date, to: Date;
      
      switch (type) {
        case 'daily':
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'weekly': {
          const day = now.getDay();
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7);
          break;
        }
        case 'monthly':
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'yearly':
          from = new Date(now.getFullYear(), 0, 1);
          to = new Date(now.getFullYear() + 1, 0, 1);
          break;
        default:
          throw new HttpException('Invalid type', HttpStatus.BAD_REQUEST);
      }

      // Query sessions for user in date range
      const sessions = await this.sessionModel.find({
        userId,
        loginAt: { $gte: from, $lt: to }
      }).sort({ loginAt: 1 });

      // Get user info
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Calculate total work hours
      let totalMinutes = 0;
      const sessionRows = sessions.map(session => {
        let workingMinutes = 0;
        let workingHours = 0;
        
        if (session.loginAt && session.logoutAt) {
          workingMinutes = Math.floor((new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime()) / 60000);
          workingHours = parseFloat((workingMinutes / 60).toFixed(2));
          totalMinutes += workingMinutes;
        }

        return {
          sessionId: session._id,
          loginAt: session.loginAt,
          logoutAt: session.logoutAt,
          workingMinutes,
          workingHours,
          status: session.status
        };
      });

      // Generate CSV
      const csvHeader = 'User,Username,Report Type,Period From,Period To,Session ID,Login Time,Logout Time,Working Minutes,Working Hours,Status\n';
      const csvRows = sessionRows.map(row => {
        return [
          `"${user.displayName}"`,
          `"${user.username}"`,
          `"${type.toUpperCase()}"`,
          `"${from.toISOString().split('T')[0]}"`,
          `"${to.toISOString().split('T')[0]}"`,
          `"${row.sessionId}"`,
          `"${row.loginAt?.toISOString() || ''}"`,
          `"${row.logoutAt?.toISOString() || ''}"`,
          row.workingMinutes,
          row.workingHours,
          `"${row.status}"`
        ].join(',');
      }).join('\n');

      // Add summary row
      const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
      const summaryRow = `\n"TOTAL","${user.username}","${type.toUpperCase()}","${from.toISOString().split('T')[0]}","${to.toISOString().split('T')[0]}","${sessions.length} sessions","","",${totalMinutes},${totalHours},""`;

      const csvContent = csvHeader + csvRows + summaryRow;

      // Send CSV response
      if (res) {
        const filename = `user_work_report_${user.username}_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);
      }

      return {
        ok: true,
        data: csvContent
      };
    } catch (error) {
      console.error('Export user work report error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to export user work report', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}