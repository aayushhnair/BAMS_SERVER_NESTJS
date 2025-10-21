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

  /**
   * Convert UTC date to IST (UTC+5:30)
   */
  private toIST(date: Date): Date {
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    return new Date(date.getTime() + istOffset);
  }

  /**
   * Format date to IST string
   */
  private formatISTDate(date: Date): string {
    if (!date) return '';
    const ist = this.toIST(date);
    return ist.toISOString().replace('Z', '+05:30');
  }

  /**
   * Get start and end of day in IST
   */
  private getISTDayRange(date: Date): { from: Date; to: Date } {
    // Parse the input date as IST
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create IST midnight (00:00:00) for the given date
    const istMidnight = new Date(year, month, day, 0, 0, 0, 0);
    // Convert IST to UTC by subtracting 5:30
    const utcFrom = new Date(istMidnight.getTime() - (5.5 * 60 * 60 * 1000));
    
    // Create IST end of day (23:59:59.999)
    const istEndOfDay = new Date(year, month, day + 1, 0, 0, 0, 0);
    const utcTo = new Date(istEndOfDay.getTime() - (5.5 * 60 * 60 * 1000));
    
    return { from: utcFrom, to: utcTo };
  }

  /**
   * Get start and end of week in IST (Sunday to Saturday)
   */
  private getISTWeekRange(date: Date): { from: Date; to: Date } {
    const day = date.getDay();
    const istStartOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day, 0, 0, 0, 0);
    const istEndOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 7, 0, 0, 0, 0);
    
    const utcFrom = new Date(istStartOfWeek.getTime() - (5.5 * 60 * 60 * 1000));
    const utcTo = new Date(istEndOfWeek.getTime() - (5.5 * 60 * 60 * 1000));
    
    return { from: utcFrom, to: utcTo };
  }

  /**
   * Get start and end of month in IST
   */
  private getISTMonthRange(date: Date): { from: Date; to: Date } {
    const istStartOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const istEndOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
    
    const utcFrom = new Date(istStartOfMonth.getTime() - (5.5 * 60 * 60 * 1000));
    const utcTo = new Date(istEndOfMonth.getTime() - (5.5 * 60 * 60 * 1000));
    
    return { from: utcFrom, to: utcTo };
  }

  /**
   * Get start and end of year in IST
   */
  private getISTYearRange(date: Date): { from: Date; to: Date } {
    const istStartOfYear = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
    const istEndOfYear = new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    
    const utcFrom = new Date(istStartOfYear.getTime() - (5.5 * 60 * 60 * 1000));
    const utcTo = new Date(istEndOfYear.getTime() - (5.5 * 60 * 60 * 1000));
    
    return { from: utcFrom, to: utcTo };
  }

  @Get('sessions')
  async getSessions(
    @Query('companyId') companyId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
    @Query('showAll') showAll?: string, // For admin/debugging purposes
  ) {
    try {
      const filter: any = {};
      
      if (companyId) filter.companyId = companyId;
      if (userId) filter.userId = userId;
      
      // By default, only show active and recent sessions (last 30 days)
      // unless date range is explicitly provided or showAll=true
      const isShowAll = showAll === 'true';
      
      if (from || to) {
        filter.loginAt = {};
        if (from) filter.loginAt.$gte = new Date(from);
        if (to) filter.loginAt.$lte = new Date(to);
      } else if (!isShowAll) {
        // Default: show only active sessions or sessions from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        filter.$or = [
          { status: 'active' }, // All active sessions
          { 
            loginAt: { $gte: thirtyDaysAgo }, // Recent sessions (last 30 days)
            status: { $in: ['logged_out', 'expired', 'heartbeat_timeout', 'auto_logged_out'] }
          }
        ];
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
            } : null,
            // IST formatted times
            loginAtIST: this.formatISTDate(session.loginAt),
            logoutAtIST: session.logoutAt ? this.formatISTDate(session.logoutAt) : null,
            lastHeartbeatIST: session.lastHeartbeat ? this.formatISTDate(session.lastHeartbeat) : null
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
      
      // Date range validation - max 1 year
      let fromDate: Date;
      let toDate: Date;
      
      if (from && to) {
        fromDate = new Date(from);
        toDate = new Date(to);
        
        // Validate date range
        const diffMs = toDate.getTime() - fromDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        if (diffDays > 365) {
          throw new HttpException({
            message: 'Export date range cannot exceed 1 year (365 days). Please select a smaller date range.',
            error: 'DATE_RANGE_TOO_LARGE',
            maxDays: 365,
            requestedDays: Math.floor(diffDays)
          }, HttpStatus.BAD_REQUEST);
        }
        
        filter.loginAt = {
          $gte: fromDate,
          $lte: toDate
        };
      } else if (from) {
        // Only 'from' provided - export up to 1 year from that date
        fromDate = new Date(from);
        toDate = new Date(fromDate);
        toDate.setFullYear(toDate.getFullYear() + 1);
        
        filter.loginAt = {
          $gte: fromDate,
          $lte: toDate
        };
      } else if (to) {
        // Only 'to' provided - export up to 1 year before that date
        toDate = new Date(to);
        fromDate = new Date(toDate);
        fromDate.setFullYear(fromDate.getFullYear() - 1);
        
        filter.loginAt = {
          $gte: fromDate,
          $lte: toDate
        };
      } else {
        // No dates provided - default to last 30 days
        toDate = new Date();
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
        
        filter.loginAt = {
          $gte: fromDate,
          $lte: toDate
        };
      }

      const sessions = await this.sessionModel.find(filter).sort({ loginAt: -1 }).limit(10000); // Hard limit for safety
      
      if (sessions.length === 0) {
        throw new HttpException({
          message: 'No sessions found for the specified date range.',
          error: 'NO_SESSIONS_FOUND',
          dateRange: { from: fromDate, to: toDate }
        }, HttpStatus.NOT_FOUND);
      }

      // Get user details
      const userIds = [...new Set(sessions.map(s => s.userId))];
      const users = await this.userModel.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [String(u._id), u]));

      if (format === 'csv') {
        const csvHeader = 'SessionId,CompanyId,UserId,UserDisplayName,DeviceId,LoginAt (IST),LogoutAt (IST),Status,LastHeartbeat (IST),LoginLat,LoginLon,LoginAccuracy,WorkingHours,WorkingMinutes\n';
        const csvRows = sessions.map(session => {
          const user = userMap.get(session.userId);
          
          // Calculate work hours
          let workingHours = 0;
          let workingMinutes = 0;
          if (session.loginAt && session.logoutAt) {
            const duration = new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime();
            workingMinutes = Math.floor(duration / 60000);
            workingHours = parseFloat((workingMinutes / 60).toFixed(2));
          }
          
          return [
            session._id,
            session.companyId || '',
            session.userId,
            user?.displayName || 'Unknown',
            session.deviceId,
            this.formatISTDate(session.loginAt),
            session.logoutAt ? this.formatISTDate(session.logoutAt) : '',
            session.status,
            session.lastHeartbeat ? this.formatISTDate(session.lastHeartbeat) : '',
            session.loginLocation.coordinates[1],
            session.loginLocation.coordinates[0],
            session.loginLocation.accuracy,
            workingHours,
            workingMinutes
          ].map(field => `"${field || ''}"`).join(',');
        }).join('\n');

        const csvContent = csvHeader + csvRows;

        if (res) {
          const istNow = this.toIST(new Date());
          const dateStr = `${istNow.getFullYear()}${String(istNow.getMonth() + 1).padStart(2, '0')}${String(istNow.getDate()).padStart(2, '0')}`;
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="sessions_export_${dateStr}_IST.csv"`);
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
   * All dates are in IST (Indian Standard Time, UTC+5:30)
   * Limited to maximum 1 year for yearly reports
   */
  @Get('user-work-report')
  async getUserWorkReport(
    @Query('userId') userId: string,
    @Query('type') type: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    @Query('date') date?: string // Optional, defaults to today (IST)
  ) {
    if (!userId) {
      throw new HttpException({
        message: 'User ID is required to fetch work report.',
        error: 'USER_ID_REQUIRED'
      }, HttpStatus.BAD_REQUEST);
    }
    
    // Parse date in IST context
    const now = date ? new Date(date) : new Date();
    let from: Date, to: Date;
    
    switch (type) {
      case 'daily':
        ({ from, to } = this.getISTDayRange(now));
        break;
      case 'weekly':
        ({ from, to } = this.getISTWeekRange(now));
        break;
      case 'monthly':
        ({ from, to } = this.getISTMonthRange(now));
        break;
      case 'yearly':
        ({ from, to } = this.getISTYearRange(now));
        // Validate yearly doesn't exceed 1 year
        const diffMs = to.getTime() - from.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 366) {
          throw new HttpException({
            message: 'Yearly reports are limited to maximum 366 days. Please use a more recent date.',
            error: 'DATE_RANGE_TOO_LARGE',
            maxDays: 366
          }, HttpStatus.BAD_REQUEST);
        }
        break;
      default:
        throw new HttpException({
          message: 'Invalid report type. Must be one of: daily, weekly, monthly, yearly.',
          error: 'INVALID_REPORT_TYPE',
          allowedTypes: ['daily', 'weekly', 'monthly', 'yearly']
        }, HttpStatus.BAD_REQUEST);
    }
    
    // Query sessions for user in date range (stored as UTC in DB)
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
        loginAt: this.formatISTDate(session.loginAt),
        logoutAt: session.logoutAt ? this.formatISTDate(session.logoutAt) : null,
        workingMinutes,
        status: session.status
      };
    });
    
    // Get user info
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new HttpException({
        message: 'User not found. The user may have been deleted.',
        error: 'USER_NOT_FOUND',
        userId
      }, HttpStatus.NOT_FOUND);
    }
    
    return {
      ok: true,
      timezone: 'IST (UTC+5:30)',
      user: { userId: user._id, username: user.username, displayName: user.displayName },
      type,
      from: this.formatISTDate(from),
      to: this.formatISTDate(to),
      totalSessions: sessions.length,
      totalWorkingMinutes: totalMinutes,
      totalWorkingHours: parseFloat((totalMinutes / 60).toFixed(2)),
      sessions: sessionDetails
    };
  }

  /**
   * Export user-specific work report as CSV
   * GET /api/user-work-report/export?userId=...&type=daily|weekly|monthly|yearly&date=...
   * All dates and times are in IST (Indian Standard Time, UTC+5:30)
   * Limited to maximum 1 year date range
   */
  @Get('user-work-report/export')
  async exportUserWorkReport(
    @Query('userId') userId: string,
    @Query('type') type: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    @Query('date') date?: string,
    @Res() res?: Response,
  ) {
    if (!userId) {
      throw new HttpException({
        message: 'User ID is required to generate work report.',
        error: 'USER_ID_REQUIRED'
      }, HttpStatus.BAD_REQUEST);
    }

    try {
      // Parse date in IST context
      const now = date ? new Date(date) : new Date();
      let from: Date, to: Date;
      
      switch (type) {
        case 'daily':
          ({ from, to } = this.getISTDayRange(now));
          break;
        case 'weekly':
          ({ from, to } = this.getISTWeekRange(now));
          break;
        case 'monthly':
          ({ from, to } = this.getISTMonthRange(now));
          break;
        case 'yearly':
          ({ from, to } = this.getISTYearRange(now));
          // Validate yearly doesn't exceed 1 year
          const diffMs = to.getTime() - from.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 366) {
            throw new HttpException({
              message: 'Yearly reports are limited to maximum 366 days. Please use a more recent date.',
              error: 'DATE_RANGE_TOO_LARGE',
              maxDays: 366
            }, HttpStatus.BAD_REQUEST);
          }
          break;
        default:
          throw new HttpException({
            message: 'Invalid report type. Must be one of: daily, weekly, monthly, yearly.',
            error: 'INVALID_REPORT_TYPE',
            allowedTypes: ['daily', 'weekly', 'monthly', 'yearly']
          }, HttpStatus.BAD_REQUEST);
      }

      // Query sessions for user in date range (stored as UTC in DB)
      const sessions = await this.sessionModel.find({
        userId,
        loginAt: { $gte: from, $lt: to }
      }).sort({ loginAt: 1 });

      // Get user info
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new HttpException({
          message: 'User not found. The user may have been deleted.',
          error: 'USER_NOT_FOUND',
          userId
        }, HttpStatus.NOT_FOUND);
      }

      // Calculate total work hours and prepare session data
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

      // Format IST dates for display
      const istFrom = this.toIST(from);
      const istTo = this.toIST(to);
      const periodFromStr = `${istFrom.getFullYear()}-${String(istFrom.getMonth() + 1).padStart(2, '0')}-${String(istFrom.getDate()).padStart(2, '0')}`;
      const periodToStr = `${istTo.getFullYear()}-${String(istTo.getMonth() + 1).padStart(2, '0')}-${String(istTo.getDate()).padStart(2, '0')}`;

      // Generate CSV with IST timezone info
      const csvHeader = 'User,Username,Report Type,Period From (IST),Period To (IST),Session ID,Login Time (IST),Logout Time (IST),Working Minutes,Working Hours,Status\n';
      const csvRows = sessionRows.map(row => {
        return [
          `"${user.displayName}"`,
          `"${user.username}"`,
          `"${type.toUpperCase()}"`,
          `"${periodFromStr}"`,
          `"${periodToStr}"`,
          `"${row.sessionId}"`,
          `"${this.formatISTDate(row.loginAt)}"`,
          `"${row.logoutAt ? this.formatISTDate(row.logoutAt) : ''}"`,
          row.workingMinutes,
          row.workingHours,
          `"${row.status}"`
        ].join(',');
      }).join('\n');

      // Add summary row
      const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
      const summaryRow = `\n"TOTAL","${user.username}","${type.toUpperCase()}","${periodFromStr}","${periodToStr}","${sessions.length} sessions","","",${totalMinutes},${totalHours},""`;

      const csvContent = csvHeader + csvRows + summaryRow;

      // Send CSV response
      if (res) {
        const istNow = this.toIST(new Date());
        const dateStr = `${istNow.getFullYear()}${String(istNow.getMonth() + 1).padStart(2, '0')}${String(istNow.getDate()).padStart(2, '0')}`;
        const filename = `user_work_report_${user.username}_${type}_${dateStr}_IST.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
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