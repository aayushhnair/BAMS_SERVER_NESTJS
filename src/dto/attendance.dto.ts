import { IsOptional, IsString, IsDateString, IsEnum, IsMongoId } from 'class-validator';

export enum AttendancePeriod {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export enum AttendanceFormat {
  JSON = 'json',
  CSV = 'csv'
}

export class AttendanceQueryDto {
  @IsOptional()
  @IsMongoId()
  companyId?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(AttendancePeriod)
  period?: AttendancePeriod;

  @IsOptional()
  @IsEnum(AttendanceFormat)
  format?: AttendanceFormat;
}

export interface DailyAttendanceRecord {
  date: string;
  userId: string;
  username: string;
  userDisplayName: string;
  companyId?: string;
  sessions: SessionSummary[];
  totalSessions: number;
  totalWorkingHours: number;
  totalWorkingMinutes: number;
  firstLoginTime?: string;
  lastLogoutTime?: string;
  isPresent: boolean;
  breaks: BreakSummary[];
  totalBreakTime: number;
  effectiveWorkingHours: number;
}

export interface SessionSummary {
  sessionId: string;
  deviceId: string;
  loginAt: string;
  logoutAt?: string;
  duration?: number; // in minutes
  status: string;
  lastHeartbeat?: string;
}

export interface BreakSummary {
  startTime: string;
  endTime?: string;
  duration?: number; // in minutes
  type: 'between_sessions' | 'incomplete_session';
}

export interface MonthlyAttendanceRecord {
  month: string; // YYYY-MM format
  year: number;
  monthName: string;
  userId: string;
  username: string;
  userDisplayName: string;
  companyId?: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercentage: number;
  totalWorkingHours: number;
  averageWorkingHoursPerDay: number;
  totalSessions: number;
  dailyRecords: DailyAttendanceRecord[];
}

export interface YearlyAttendanceRecord {
  year: number;
  userId: string;
  username: string;
  userDisplayName: string;
  companyId?: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercentage: number;
  totalWorkingHours: number;
  averageWorkingHoursPerDay: number;
  averageWorkingHoursPerMonth: number;
  totalSessions: number;
  monthlyRecords: MonthlyAttendanceRecord[];
  monthlyBreakdown: {
    month: string;
    presentDays: number;
    workingHours: number;
    attendancePercentage: number;
  }[];
}

export interface AttendanceAnalytics {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  averageWorkingHours: number;
  topPerformers: {
    userId: string;
    username: string;
    userDisplayName: string;
    workingHours: number;
    attendancePercentage: number;
  }[];
  attendanceTrends: {
    date: string;
    presentCount: number;
    totalEmployees: number;
    attendancePercentage: number;
  }[];
}