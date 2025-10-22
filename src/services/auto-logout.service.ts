import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AutoLogoutService {
  private readonly logger = new Logger(AutoLogoutService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoLogout() {
    try {
      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 12;
  const heartbeatMinutes = this.configService.get<number>('heartbeatMinutes') || 5;
  const heartbeatGraceFactor = this.configService.get<number>('heartbeatGraceFactor') || 2;

  const now = new Date();
  const sessionTimeoutMs = sessionTimeoutHours * 60 * 60 * 1000;
  const heartbeatTimeoutMs = heartbeatMinutes * heartbeatGraceFactor * 60 * 1000;

      // Find sessions that should be auto-logged out
      const sessionsToAutoLogout = await this.sessionModel.find({
        status: 'active',
        $or: [
          // Sessions where login time + session timeout has passed
          {
            loginAt: {
              $lte: new Date(now.getTime() - sessionTimeoutMs)
            }
          },
          // Sessions where last heartbeat is stale (older than heartbeat timeout)
          {
            lastHeartbeat: {
              $lte: new Date(now.getTime() - heartbeatTimeoutMs)
            }
          }
        ]
      });

      if (sessionsToAutoLogout.length > 0) {
        // Update these sessions to auto_logged_out
        const sessionIds = sessionsToAutoLogout.map(session => session._id);
        
        await this.sessionModel.updateMany(
          { _id: { $in: sessionIds } },
          {
            logoutAt: now,
            status: 'auto_logged_out'
          }
        );

        this.logger.log(`Auto-logged out ${sessionsToAutoLogout.length} sessions`);
      } else {
        this.logger.debug('No sessions to auto-logout');
      }
    } catch (error) {
      this.logger.error('Failed to run auto-logout job', error);
    }
  }

  // Additional cron: run every 30 minutes to ensure heartbeat-based logouts are enforced
  @Cron('0 */30 * * * *') // every 30 minutes at 0 seconds
  async handleHeartbeatAutoLogout() {
    await this.performHeartbeatLogout();
  }

  /**
   * Public method to run heartbeat-based logout. Can be called from a webhook for serverless deployments.
   * Returns the number of sessions auto-logged-out.
   */
  async performHeartbeatLogout(): Promise<number> {
    try {
      const heartbeatMinutes = this.configService.get<number>('heartbeatMinutes') || 5;
      const heartbeatGraceFactor = this.configService.get<number>('heartbeatGraceFactor') || 2;

      const now = new Date();
      const heartbeatTimeoutMs = heartbeatMinutes * heartbeatGraceFactor * 60 * 1000;

      const sessionsToLogout = await this.sessionModel.find({
        status: 'active',
        lastHeartbeat: { $lte: new Date(now.getTime() - heartbeatTimeoutMs) }
      });

      if (sessionsToLogout.length > 0) {
        const ids = sessionsToLogout.map(s => s._id);
        await this.sessionModel.updateMany(
          { _id: { $in: ids } },
          { logoutAt: now, status: 'auto_logged_out' }
        );
        // Log a few samples to help triage which users/devices are affected
        const samples = sessionsToLogout.slice(0, 5).map(s => ({ sessionId: String(s._id), userId: s.userId, deviceId: s.deviceId }));
        this.logger.warn(`Heartbeat task: auto-logged out ${sessionsToLogout.length} sessions due to missing heartbeats`, { count: sessionsToLogout.length, samples });
      } else {
        this.logger.debug('Heartbeat task: no stale heartbeat sessions to auto-logout');
      }

      return sessionsToLogout.length;
    } catch (error) {
      this.logger.error('Failed to run heartbeat auto-logout task', error);
      throw error;
    }
  }

  /**
   * Perform daily aggregation at end of day: close active sessions based on lastHeartbeat
   * and cap session duration to sessionTimeoutHours.
   * Returns number of sessions updated.
   */
  async performDailyAggregation(): Promise<number> {
    try {
      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 12;
      const now = new Date();

      // Find all active sessions
      const sessions = await this.sessionModel.find({ status: 'active' });

      if (!sessions || sessions.length === 0) {
        this.logger.debug('Daily aggregation: no active sessions to process');
        return 0;
      }

      // Calculate midnight IST boundary (00:00 IST of current day) in UTC.
      // IST is UTC+5:30, so midnight IST = (today at 00:00 IST) => UTC = today at 00:00 - 5.5 hours.
      const nowUtc = new Date();
      const istOffsetMinutes = 5 * 60 + 30; // 330 minutes

      // Determine today's date in IST by shifting now by +330 minutes, then set to midnight, then shift back to UTC.
      const asIst = new Date(nowUtc.getTime() + istOffsetMinutes * 60 * 1000);
      const istMidnight = new Date(asIst.getFullYear(), asIst.getMonth(), asIst.getDate(), 0, 0, 0, 0);
      const istMidnightUtc = new Date(istMidnight.getTime() - istOffsetMinutes * 60 * 1000);

      const bulkOps: any[] = [];
      let processedCount = 0;

      for (const session of sessions) {
        // Compute cap based on loginAt + timeout, lastHeartbeat (or loginAt), and now.
        const maxLogout = new Date(session.loginAt.getTime() + sessionTimeoutHours * 60 * 60 * 1000);
        const lastHb = session.lastHeartbeat || session.loginAt;
        let chosenLogout = lastHb.getTime() < maxLogout.getTime() ? lastHb : maxLogout;
        if (chosenLogout.getTime() > now.getTime()) chosenLogout = now;

        // If session.loginAt is before istMidnightUtc and chosenLogout is after istMidnightUtc, we need to split.
        const loginAt = session.loginAt;
        const logoutAt = chosenLogout;

        if (loginAt.getTime() < istMidnightUtc.getTime() && logoutAt.getTime() > istMidnightUtc.getTime()) {
          // Close the first part at midnight IST (UTC time)
          const firstPartLogout = new Date(istMidnightUtc);
          // workedSeconds for first part: difference between firstPartLogout and loginAt, floored to seconds
          const workedSecondsFirst = Math.max(0, Math.floor((firstPartLogout.getTime() - loginAt.getTime()) / 1000));

          bulkOps.push({
            updateOne: {
              filter: { _id: session._id },
              update: { logoutAt: firstPartLogout, status: 'auto_logged_out', workedSeconds: workedSecondsFirst }
            }
          });

          // For the remaining part, create a new session starting at midnight IST (loginAt = istMidnightUtc)
          // The remaining portion may also be immediately capped by logoutAt (if logoutAt <= now but > midnight)
          const remainingLogin = new Date(istMidnightUtc);
          // remaining logout is original logoutAt (capped already to now and session timeout)
          const remainingLogout = logoutAt;

          // If remainingLogout <= remainingLogin then the remainder has no duration; still create record with zero workedSeconds but mark as auto_logged_out.
          const workedSecondsRemaining = Math.max(0, Math.floor((remainingLogout.getTime() - remainingLogin.getTime()) / 1000));

          const newSessionDoc: any = {
            companyId: session.companyId,
            userId: session.userId,
            deviceId: session.deviceId,
            loginAt: remainingLogin,
            loginLocation: session.loginLocation,
            lastHeartbeat: session.lastHeartbeat && session.lastHeartbeat.getTime() > remainingLogin.getTime() ? session.lastHeartbeat : remainingLogin,
            logoutAt: remainingLogout,
            status: 'auto_logged_out',
            workedSeconds: workedSecondsRemaining
          };

          bulkOps.push({ insertOne: { document: newSessionDoc } });
          processedCount += 1;
        } else {
          // No split required; just close this session at logoutAt and set workedSeconds accordingly.
          const workedSeconds = Math.max(0, Math.floor((logoutAt.getTime() - loginAt.getTime()) / 1000));
          bulkOps.push({
            updateOne: {
              filter: { _id: session._id },
              update: { logoutAt: logoutAt, status: 'auto_logged_out', workedSeconds }
            }
          });
          processedCount += 1;
        }
      }

      // Execute bulk operations in reasonable chunks to avoid large payloads.
      const chunkSize = 500;
      for (let i = 0; i < bulkOps.length; i += chunkSize) {
        const chunk = bulkOps.slice(i, i + chunkSize);
        await this.sessionModel.bulkWrite(chunk, { ordered: false });
      }

  this.logger.log(`Daily aggregation: processed ${processedCount} active sessions (split where necessary)`);
  return processedCount;
    } catch (error) {
      this.logger.error('Failed to perform daily aggregation', error);
      throw error;
    }
  }
}