import { Controller, Get, Query, HttpException, HttpStatus, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Response } from 'express';
import { Session, SessionDocument } from '../schemas/session.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { AttendanceQueryDto, DailyAttendanceRecord, MonthlyAttendanceRecord, YearlyAttendanceRecord, AttendanceAnalytics, AttendancePeriod, AttendanceFormat } from '../dto/attendance.dto';
import { AttendanceUtils } from '../utils/attendance.utils';

@Controller('api/attendance')
export class AttendanceController {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  @Get('daily')
  async getDailyAttendance(@Query() query: AttendanceQueryDto, @Res() res?: Response) {
    try {
      const { companyId, userId, username, from, to, format = AttendanceFormat.JSON } = query;
      
      // Build query filters
      const filters: any = {};
      if (companyId) filters.companyId = companyId;
      if (userId) filters.userId = userId;

      // Date range - default to today if not specified
      const dateRange = from && to ? 
        { start: new Date(from), end: new Date(to) } :
        AttendanceUtils.getDateRange('daily');

      filters.loginAt = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };

      // If username is provided, find the user first
      if (username && !userId) {
        const user = await this.userModel.findOne({ username });
        if (user) {
          filters.userId = user._id;
        } else {
          return { ok: false, error: 'User not found' };
        }
      }

      // Get sessions for the date range
      const sessions = await this.sessionModel.find(filters)
        .sort({ loginAt: 1 })
        .populate('userId', 'username displayName')
        .exec();

      // Group sessions by user and date
      const userSessions = new Map<string, Map<string, SessionDocument[]>>();
      
      for (const session of sessions) {
        const userKey = String(session.userId);
        const dateKey = session.loginAt.toISOString().split('T')[0];
        
        if (!userSessions.has(userKey)) {
          userSessions.set(userKey, new Map());
        }
        
        const userDateSessions = userSessions.get(userKey)!;
        if (!userDateSessions.has(dateKey)) {
          userDateSessions.set(dateKey, []);
        }
        
        userDateSessions.get(dateKey)!.push(session);
      }

      // Create daily attendance records
      const dailyRecords: DailyAttendanceRecord[] = [];
      
      for (const [userKey, userDateSessions] of userSessions) {
        const userInfo = await this.userModel.findById(userKey);
        if (!userInfo) continue;

        for (const [date, dateSessions] of userDateSessions) {
          const dailyRecord = AttendanceUtils.createDailyRecord(
            date,
            userKey,
            userInfo.username,
            userInfo.displayName,
            userInfo.companyId,
            dateSessions
          );
          dailyRecords.push(dailyRecord);
        }
      }

      // Sort by date and user
      dailyRecords.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare === 0) {
          return a.username.localeCompare(b.username);
        }
        return dateCompare;
      });

      if (format === AttendanceFormat.CSV) {
        return this.generateDailyCSV(dailyRecords, res!);
      }

      return res ? res.json({
        ok: true,
        period: 'daily',
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        totalRecords: dailyRecords.length,
        records: dailyRecords
      }) : {
        ok: true,
        period: 'daily',
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        totalRecords: dailyRecords.length,
        records: dailyRecords
      };
    } catch (error) {
      throw new HttpException('Failed to fetch daily attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('monthly')
  async getMonthlyAttendance(@Query() query: AttendanceQueryDto, @Res() res?: Response) {
    try {
      const { companyId, userId, username, from, to, format = AttendanceFormat.JSON } = query;
      
      // Build base filters
      const filters: any = {};
      if (companyId) filters.companyId = companyId;
      if (userId) filters.userId = userId;

      // Date range - default to current month if not specified
      const dateRange = from && to ? 
        { start: new Date(from), end: new Date(to) } :
        AttendanceUtils.getDateRange('monthly');

      filters.loginAt = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };

      // If username is provided, find the user first
      if (username && !userId) {
        const user = await this.userModel.findOne({ username });
        if (user) {
          filters.userId = user._id;
        } else {
          return { ok: false, error: 'User not found' };
        }
      }

      // Get all sessions in the date range
      const sessions = await this.sessionModel.find(filters)
        .sort({ loginAt: 1 })
        .exec();

      // Get user information
      const userIds = [...new Set(sessions.map(s => String(s.userId)))];
      const users = await this.userModel.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [String(u._id), u]));

      // Group sessions by user and month
      const userMonthSessions = new Map<string, Map<string, SessionDocument[]>>();
      
      for (const session of sessions) {
        const userKey = String(session.userId);
        const monthKey = session.loginAt.toISOString().substring(0, 7); // YYYY-MM
        
        if (!userMonthSessions.has(userKey)) {
          userMonthSessions.set(userKey, new Map());
        }
        
        const userMonthlyData = userMonthSessions.get(userKey)!;
        if (!userMonthlyData.has(monthKey)) {
          userMonthlyData.set(monthKey, []);
        }
        
        userMonthlyData.get(monthKey)!.push(session);
      }

      // Create monthly attendance records
      const monthlyRecords: MonthlyAttendanceRecord[] = [];
      
      for (const [userKey, userMonthlyData] of userMonthSessions) {
        const userInfo = userMap.get(userKey);
        if (!userInfo) continue;

        for (const [monthKey, monthSessions] of userMonthlyData) {
          const [year, month] = monthKey.split('-').map(Number);
          
          // Group sessions by date for daily records
          const dailySessions = AttendanceUtils.groupSessionsByDate(monthSessions);
          const dailyRecords: DailyAttendanceRecord[] = [];
          
          for (const [date, dateSessions] of dailySessions) {
            const dailyRecord = AttendanceUtils.createDailyRecord(
              date,
              userKey,
              userInfo.username,
              userInfo.displayName,
              userInfo.companyId,
              dateSessions
            );
            dailyRecords.push(dailyRecord);
          }

          // Calculate monthly stats
          const totalWorkingDays = AttendanceUtils.getWorkingDaysInMonth(year, month - 1);
          const presentDays = dailyRecords.filter(r => r.isPresent).length;
          const absentDays = totalWorkingDays - presentDays;
          const totalWorkingHours = dailyRecords.reduce((sum, r) => sum + r.totalWorkingHours, 0);
          const attendancePercentage = AttendanceUtils.calculateAttendancePercentage(presentDays, totalWorkingDays);

          const monthlyRecord: MonthlyAttendanceRecord = {
            month: monthKey,
            year,
            monthName: AttendanceUtils.getMonthName(month - 1),
            userId: userKey,
            username: userInfo.username,
            userDisplayName: userInfo.displayName,
            companyId: userInfo.companyId,
            totalWorkingDays,
            presentDays,
            absentDays,
            attendancePercentage,
            totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
            averageWorkingHoursPerDay: presentDays > 0 ? Math.round((totalWorkingHours / presentDays) * 100) / 100 : 0,
            totalSessions: monthSessions.length,
            dailyRecords: dailyRecords.sort((a, b) => a.date.localeCompare(b.date))
          };

          monthlyRecords.push(monthlyRecord);
        }
      }

      // Sort by month and user
      monthlyRecords.sort((a, b) => {
        const monthCompare = a.month.localeCompare(b.month);
        if (monthCompare === 0) {
          return a.username.localeCompare(b.username);
        }
        return monthCompare;
      });

      if (format === AttendanceFormat.CSV) {
        return this.generateMonthlyCSV(monthlyRecords, res!);
      }

      return res ? res.json({
        ok: true,
        period: 'monthly',
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        totalRecords: monthlyRecords.length,
        records: monthlyRecords
      }) : {
        ok: true,
        period: 'monthly',
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        totalRecords: monthlyRecords.length,
        records: monthlyRecords
      };
    } catch (error) {
      throw new HttpException('Failed to fetch monthly attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('yearly')
  async getYearlyAttendance(@Query() query: AttendanceQueryDto, @Res() res?: Response) {
    try {
      const { companyId, userId, username, from, to, format = AttendanceFormat.JSON } = query;
      
      // Build base filters
      const filters: any = {};
      if (companyId) filters.companyId = companyId;
      if (userId) filters.userId = userId;

      // Date range - default to current year if not specified
      const dateRange = from && to ? 
        { start: new Date(from), end: new Date(to) } :
        AttendanceUtils.getDateRange('yearly');

      filters.loginAt = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };

      // If username is provided, find the user first
      if (username && !userId) {
        const user = await this.userModel.findOne({ username });
        if (user) {
          filters.userId = user._id;
        } else {
          return { ok: false, error: 'User not found' };
        }
      }

      // Get all sessions in the date range
      const sessions = await this.sessionModel.find(filters)
        .sort({ loginAt: 1 })
        .exec();

      // Get user information
      const userIds = [...new Set(sessions.map(s => String(s.userId)))];
      const users = await this.userModel.find({ _id: { $in: userIds } });
      const userMap = new Map(users.map(u => [String(u._id), u]));

      // Group sessions by user and year
      const userYearSessions = new Map<string, Map<number, SessionDocument[]>>();
      
      for (const session of sessions) {
        const userKey = String(session.userId);
        const year = session.loginAt.getFullYear();
        
        if (!userYearSessions.has(userKey)) {
          userYearSessions.set(userKey, new Map());
        }
        
        const userYearlyData = userYearSessions.get(userKey)!;
        if (!userYearlyData.has(year)) {
          userYearlyData.set(year, []);
        }
        
        userYearlyData.get(year)!.push(session);
      }

      // Create yearly attendance records
      const yearlyRecords: YearlyAttendanceRecord[] = [];
      
      for (const [userKey, userYearlyData] of userYearSessions) {
        const userInfo = userMap.get(userKey);
        if (!userInfo) continue;

        for (const [year, yearSessions] of userYearlyData) {
          // Group sessions by month for monthly records
          const monthlySessions = new Map<string, SessionDocument[]>();
          
          for (const session of yearSessions) {
            const monthKey = session.loginAt.toISOString().substring(0, 7); // YYYY-MM
            if (!monthlySessions.has(monthKey)) {
              monthlySessions.set(monthKey, []);
            }
            monthlySessions.get(monthKey)!.push(session);
          }

          // Create monthly records
          const monthlyRecords: MonthlyAttendanceRecord[] = [];
          let totalPresentDays = 0;
          let totalWorkingHours = 0;
          let totalSessions = 0;

          for (const [monthKey, monthSessions] of monthlySessions) {
            const [_, month] = monthKey.split('-').map(Number);
            
            // Group sessions by date for daily records
            const dailySessions = AttendanceUtils.groupSessionsByDate(monthSessions);
            const dailyRecords: DailyAttendanceRecord[] = [];
            
            for (const [date, dateSessions] of dailySessions) {
              const dailyRecord = AttendanceUtils.createDailyRecord(
                date,
                userKey,
                userInfo.username,
                userInfo.displayName,
                userInfo.companyId,
                dateSessions
              );
              dailyRecords.push(dailyRecord);
            }

            // Calculate monthly stats
            const monthWorkingDays = AttendanceUtils.getWorkingDaysInMonth(year, month - 1);
            const monthPresentDays = dailyRecords.filter(r => r.isPresent).length;
            const monthWorkingHours = dailyRecords.reduce((sum, r) => sum + r.totalWorkingHours, 0);
            
            totalPresentDays += monthPresentDays;
            totalWorkingHours += monthWorkingHours;
            totalSessions += monthSessions.length;

            const monthlyRecord: MonthlyAttendanceRecord = {
              month: monthKey,
              year,
              monthName: AttendanceUtils.getMonthName(month - 1),
              userId: userKey,
              username: userInfo.username,
              userDisplayName: userInfo.displayName,
              companyId: userInfo.companyId,
              totalWorkingDays: monthWorkingDays,
              presentDays: monthPresentDays,
              absentDays: monthWorkingDays - monthPresentDays,
              attendancePercentage: AttendanceUtils.calculateAttendancePercentage(monthPresentDays, monthWorkingDays),
              totalWorkingHours: Math.round(monthWorkingHours * 100) / 100,
              averageWorkingHoursPerDay: monthPresentDays > 0 ? Math.round((monthWorkingHours / monthPresentDays) * 100) / 100 : 0,
              totalSessions: monthSessions.length,
              dailyRecords: dailyRecords.sort((a, b) => a.date.localeCompare(b.date))
            };

            monthlyRecords.push(monthlyRecord);
          }

          // Calculate yearly stats
          const totalWorkingDays = AttendanceUtils.getWorkingDaysInYear(year);
          const absentDays = totalWorkingDays - totalPresentDays;
          const attendancePercentage = AttendanceUtils.calculateAttendancePercentage(totalPresentDays, totalWorkingDays);

          // Create monthly breakdown
          const monthlyBreakdown = monthlyRecords.map(mr => ({
            month: mr.month,
            presentDays: mr.presentDays,
            workingHours: mr.totalWorkingHours,
            attendancePercentage: mr.attendancePercentage
          }));

          const yearlyRecord: YearlyAttendanceRecord = {
            year,
            userId: userKey,
            username: userInfo.username,
            userDisplayName: userInfo.displayName,
            companyId: userInfo.companyId,
            totalWorkingDays,
            presentDays: totalPresentDays,
            absentDays,
            attendancePercentage,
            totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
            averageWorkingHoursPerDay: totalPresentDays > 0 ? Math.round((totalWorkingHours / totalPresentDays) * 100) / 100 : 0,
            averageWorkingHoursPerMonth: monthlyRecords.length > 0 ? Math.round((totalWorkingHours / monthlyRecords.length) * 100) / 100 : 0,
            totalSessions,
            monthlyRecords: monthlyRecords.sort((a, b) => a.month.localeCompare(b.month)),
            monthlyBreakdown
          };

          yearlyRecords.push(yearlyRecord);
        }
      }

      // Sort by year and user
      yearlyRecords.sort((a, b) => {
        const yearCompare = a.year - b.year;
        if (yearCompare === 0) {
          return a.username.localeCompare(b.username);
        }
        return yearCompare;
      });

      if (format === AttendanceFormat.CSV) {
        return this.generateYearlyCSV(yearlyRecords, res!);
      }

      return res ? res.json({
        ok: true,
        period: 'yearly',
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        totalRecords: yearlyRecords.length,
        records: yearlyRecords
      }) : {
        ok: true,
        period: 'yearly',
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        totalRecords: yearlyRecords.length,
        records: yearlyRecords
      };
    } catch (error) {
      throw new HttpException('Failed to fetch yearly attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('analytics')
  async getAttendanceAnalytics(@Query() query: AttendanceQueryDto) {
    try {
      const { companyId, from, to } = query;
      
      // Date range - default to current month if not specified
      const dateRange = from && to ? 
        { start: new Date(from), end: new Date(to) } :
        AttendanceUtils.getDateRange('monthly');

      // Build filters
      const filters: any = {
        loginAt: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      };
      if (companyId) filters.companyId = companyId;

      // Get all sessions and users
      const sessions = await this.sessionModel.find(filters).exec();
      const userFilters: any = {};
      if (companyId) userFilters.companyId = companyId;
      const allUsers = await this.userModel.find(userFilters).exec();

      // Calculate today's attendance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todaySessions = sessions.filter(s => 
        s.loginAt >= today && s.loginAt <= todayEnd
      );
      const presentTodayUserIds = new Set(todaySessions.map(s => String(s.userId)));

      // Group sessions by user for analytics
      const userSessions = new Map<string, SessionDocument[]>();
      for (const session of sessions) {
        const userKey = String(session.userId);
        if (!userSessions.has(userKey)) {
          userSessions.set(userKey, []);
        }
        userSessions.get(userKey)!.push(session);
      }

      // Calculate user statistics
      interface UserStat {
        userId: string;
        username: string;
        userDisplayName: string;
        workingHours: number;
        attendancePercentage: number;
        presentDays: number;
        totalDays: number;
      }

      const userStats: UserStat[] = [];
      for (const user of allUsers) {
        const userKey = String(user._id);
        const userSessionList = userSessions.get(userKey) || [];
        
        const dailySessions = AttendanceUtils.groupSessionsByDate(userSessionList);
        const presentDays = dailySessions.size;
        const totalWorkingHours = Array.from(dailySessions.values())
          .reduce((sum, sessions) => sum + AttendanceUtils.calculateDailyWorkingHours(sessions), 0);
        
        const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
        const attendancePercentage = AttendanceUtils.calculateAttendancePercentage(presentDays, totalDays);

        userStats.push({
          userId: userKey,
          username: user.username,
          userDisplayName: user.displayName,
          workingHours: Math.round(totalWorkingHours * 100) / 100,
          attendancePercentage,
          presentDays,
          totalDays
        });
      }

      // Get top performers (by working hours)
      const topPerformers = userStats
        .sort((a, b) => b.workingHours - a.workingHours)
        .slice(0, 5)
        .map(({ totalDays, presentDays, ...rest }) => rest);

      // Calculate attendance trends (daily)
      interface AttendanceTrend {
        date: string;
        presentCount: number;
        totalEmployees: number;
        attendancePercentage: number;
      }

      const attendanceTrends: AttendanceTrend[] = [];
      const currentDate = new Date(dateRange.start);
      while (currentDate <= dateRange.end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const daySessions = sessions.filter(s => 
          s.loginAt >= dayStart && s.loginAt <= dayEnd
        );
        const presentCount = new Set(daySessions.map(s => String(s.userId))).size;
        const attendancePercentage = AttendanceUtils.calculateAttendancePercentage(presentCount, allUsers.length);

        attendanceTrends.push({
          date: dateKey,
          presentCount,
          totalEmployees: allUsers.length,
          attendancePercentage
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const analytics: AttendanceAnalytics = {
        totalEmployees: allUsers.length,
        presentToday: presentTodayUserIds.size,
        absentToday: allUsers.length - presentTodayUserIds.size,
        averageWorkingHours: userStats.length > 0 ? 
          Math.round((userStats.reduce((sum, u) => sum + u.workingHours, 0) / userStats.length) * 100) / 100 : 0,
        topPerformers,
        attendanceTrends
      };

      return {
        ok: true,
        dateRange: {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString()
        },
        analytics
      };
    } catch (error) {
      throw new HttpException('Failed to fetch attendance analytics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private generateDailyCSV(records: DailyAttendanceRecord[], res: Response): void {
    const headers = [
      'Date',
      'User ID',
      'Username', 
      'Display Name',
      'Company ID',
      'Total Sessions',
      'Total Working Hours',
      'Total Working Minutes',
      'First Login Time',
      'Last Logout Time',
      'Is Present',
      'Total Break Time (Hours)',
      'Effective Working Hours',
      'Session Details'
    ];

    const csvRows = [headers.join(',')];

    for (const record of records) {
      const sessionDetails = record.sessions.map(s => 
        `${s.deviceId}(${s.loginAt}-${s.logoutAt || 'active'}:${s.duration || 0}min)`
      ).join(';');

      const row = [
        record.date,
        record.userId,
        record.username,
        `"${record.userDisplayName}"`,
        record.companyId,
        record.totalSessions,
        record.totalWorkingHours,
        record.totalWorkingMinutes,
        record.firstLoginTime || '',
        record.lastLogoutTime || '',
        record.isPresent,
        record.totalBreakTime,
        record.effectiveWorkingHours,
        `"${sessionDetails}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = `daily_attendance_${new Date().toISOString().split('T')[0]}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.send(csvContent);
  }

  private generateMonthlyCSV(records: MonthlyAttendanceRecord[], res: Response): void {
    const headers = [
      'Month',
      'Year',
      'Month Name',
      'User ID',
      'Username',
      'Display Name', 
      'Company ID',
      'Total Working Days',
      'Present Days',
      'Absent Days',
      'Attendance Percentage',
      'Total Working Hours',
      'Average Working Hours Per Day',
      'Total Sessions'
    ];

    const csvRows = [headers.join(',')];

    for (const record of records) {
      const row = [
        record.month,
        record.year,
        `"${record.monthName}"`,
        record.userId,
        record.username,
        `"${record.userDisplayName}"`,
        record.companyId,
        record.totalWorkingDays,
        record.presentDays,
        record.absentDays,
        record.attendancePercentage,
        record.totalWorkingHours,
        record.averageWorkingHoursPerDay,
        record.totalSessions
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = `monthly_attendance_${new Date().toISOString().split('T')[0]}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.send(csvContent);
  }

  private generateYearlyCSV(records: YearlyAttendanceRecord[], res: Response): void {
    const headers = [
      'Year',
      'User ID',
      'Username',
      'Display Name',
      'Company ID',
      'Total Working Days',
      'Present Days',
      'Absent Days',
      'Attendance Percentage',
      'Total Working Hours',
      'Average Working Hours Per Day',
      'Average Working Hours Per Month',
      'Total Sessions'
    ];

    const csvRows = [headers.join(',')];

    for (const record of records) {
      const row = [
        record.year,
        record.userId,
        record.username,
        `"${record.userDisplayName}"`,
        record.companyId,
        record.totalWorkingDays,
        record.presentDays,
        record.absentDays,
        record.attendancePercentage,
        record.totalWorkingHours,
        record.averageWorkingHoursPerDay,
        record.averageWorkingHoursPerMonth,
        record.totalSessions
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = `yearly_attendance_${new Date().toISOString().split('T')[0]}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.send(csvContent);
  }
}