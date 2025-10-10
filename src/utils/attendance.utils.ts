import { SessionDocument } from '../schemas/session.schema';
import { DailyAttendanceRecord, SessionSummary, BreakSummary } from '../dto/attendance.dto';

export class AttendanceUtils {
  /**
   * Calculate session duration in minutes
   */
  static calculateSessionDuration(loginAt: Date, logoutAt?: Date): number {
    if (!logoutAt) return 0;
    return Math.floor((logoutAt.getTime() - loginAt.getTime()) / (1000 * 60));
  }

  /**
   * Calculate total working hours for a day from sessions
   */
  static calculateDailyWorkingHours(sessions: SessionDocument[]): number {
    let totalMinutes = 0;
    
    for (const session of sessions) {
      if (session.logoutAt) {
        totalMinutes += this.calculateSessionDuration(session.loginAt, session.logoutAt);
      }
    }
    
    return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate breaks between sessions
   */
  static calculateBreaks(sessions: SessionDocument[]): BreakSummary[] {
    const breaks: BreakSummary[] = [];
    const completedSessions = sessions
      .filter(s => s.logoutAt)
      .sort((a, b) => a.loginAt.getTime() - b.loginAt.getTime());

    for (let i = 0; i < completedSessions.length - 1; i++) {
      const currentSession = completedSessions[i];
      const nextSession = completedSessions[i + 1];
      
      if (currentSession.logoutAt && nextSession.loginAt) {
        const breakDuration = this.calculateSessionDuration(
          currentSession.logoutAt,
          nextSession.loginAt
        );
        
        // Only consider breaks longer than 5 minutes
        if (breakDuration > 5) {
          breaks.push({
            startTime: currentSession.logoutAt.toISOString(),
            endTime: nextSession.loginAt.toISOString(),
            duration: breakDuration,
            type: 'between_sessions'
          });
        }
      }
    }

    return breaks;
  }

  /**
   * Convert sessions to session summaries
   */
  static convertToSessionSummaries(sessions: SessionDocument[]): SessionSummary[] {
    return sessions.map(session => ({
      sessionId: String(session._id),
      deviceId: session.deviceId,
      loginAt: session.loginAt.toISOString(),
      logoutAt: session.logoutAt?.toISOString(),
      duration: session.logoutAt ? 
        this.calculateSessionDuration(session.loginAt, session.logoutAt) : undefined,
      status: session.status,
      lastHeartbeat: session.lastHeartbeat?.toISOString()
    }));
  }

  /**
   * Create daily attendance record from sessions
   */
  static createDailyRecord(
    date: string,
    userId: string,
    username: string,
    userDisplayName: string,
    companyId: string | undefined,
    sessions: SessionDocument[]
  ): DailyAttendanceRecord {
    const sessionSummaries = this.convertToSessionSummaries(sessions);
    const breaks = this.calculateBreaks(sessions);
    const totalWorkingHours = this.calculateDailyWorkingHours(sessions);
    const totalBreakTime = breaks.reduce((sum, brk) => sum + (brk.duration || 0), 0) / 60;
    
    const sortedSessions = sessions
      .filter(s => s.loginAt)
      .sort((a, b) => a.loginAt.getTime() - b.loginAt.getTime());
    
    const firstLogin = sortedSessions.length > 0 ? sortedSessions[0].loginAt : null;
    const lastLogout = sessions
      .filter(s => s.logoutAt)
      .sort((a, b) => b.logoutAt!.getTime() - a.logoutAt!.getTime())[0]?.logoutAt;

    return {
      date,
      userId,
      username,
      userDisplayName,
      companyId,
      sessions: sessionSummaries,
      totalSessions: sessions.length,
      totalWorkingHours,
      totalWorkingMinutes: Math.round(totalWorkingHours * 60),
      firstLoginTime: firstLogin?.toISOString(),
      lastLogoutTime: lastLogout?.toISOString(),
      isPresent: sessions.length > 0,
      breaks,
      totalBreakTime: Math.round(totalBreakTime * 100) / 100,
      effectiveWorkingHours: Math.round((totalWorkingHours - totalBreakTime) * 100) / 100
    };
  }

  /**
   * Get date range for period
   */
  static getDateRange(period: string, date?: string): { start: Date; end: Date } {
    const baseDate = date ? new Date(date) : new Date();
    
    switch (period) {
      case 'daily':
        const start = new Date(baseDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(baseDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
        
      case 'monthly':
        const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: monthStart, end: monthEnd };
        
      case 'yearly':
        const yearStart = new Date(baseDate.getFullYear(), 0, 1);
        const yearEnd = new Date(baseDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start: yearStart, end: yearEnd };
        
      default:
        throw new Error('Invalid period specified');
    }
  }

  /**
   * Group sessions by date
   */
  static groupSessionsByDate(sessions: SessionDocument[]): Map<string, SessionDocument[]> {
    const grouped = new Map<string, SessionDocument[]>();
    
    for (const session of sessions) {
      const dateKey = session.loginAt.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(session);
    }
    
    return grouped;
  }

  /**
   * Calculate attendance percentage
   */
  static calculateAttendancePercentage(presentDays: number, totalDays: number): number {
    if (totalDays === 0) return 0;
    return Math.round((presentDays / totalDays) * 100 * 100) / 100;
  }

  /**
   * Get working days in a month (excluding weekends)
   */
  static getWorkingDaysInMonth(year: number, month: number): number {
    const date = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= lastDay; day++) {
      date.setDate(day);
      const dayOfWeek = date.getDay();
      // Exclude Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  /**
   * Get working days in a year
   */
  static getWorkingDaysInYear(year: number): number {
    let totalWorkingDays = 0;
    for (let month = 0; month < 12; month++) {
      totalWorkingDays += this.getWorkingDaysInMonth(year, month);
    }
    return totalWorkingDays;
  }

  /**
   * Format duration as human readable string
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  /**
   * Get month name from month number
   */
  static getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  }
}