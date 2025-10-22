import { Controller, Post, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { AutoLogoutService } from '../services/auto-logout.service';

@Controller('internal')
export class InternalController {
  constructor(private readonly autoLogoutService: AutoLogoutService) {}

  @Post('cron/auto-logout')
  async triggerAutoLogout(
    @Headers('x-internal-cron-secret') internalSecret?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const internalExpected = process.env.INTERNAL_CRON_SECRET;
    const vercelExpected = process.env.CRON_SECRET || process.env.INTERNAL_CRON_SECRET;

    if (!internalExpected && !vercelExpected) {
      throw new HttpException('Internal cron secret not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Check either header: x-internal-cron-secret OR Authorization: Bearer <CRON_SECRET>
    let ok = false;
    if (internalSecret && internalExpected && internalSecret === internalExpected) ok = true;
    if (authorization && vercelExpected) {
      const parts = authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === vercelExpected) ok = true;
    }

    if (!ok) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const count = await this.autoLogoutService.performHeartbeatLogout();
      return { ok: true, autoLoggedOutCount: count };
    } catch (err) {
      throw new HttpException('Auto-logout failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('cron/daily-aggregate')
  async triggerDailyAggregation(
    @Headers('x-internal-cron-secret') internalSecret?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const internalExpected = process.env.INTERNAL_CRON_SECRET;
    const vercelExpected = process.env.CRON_SECRET || process.env.INTERNAL_CRON_SECRET;

    if (!internalExpected && !vercelExpected) {
      throw new HttpException('Internal cron secret not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let ok = false;
    if (internalSecret && internalExpected && internalSecret === internalExpected) ok = true;
    if (authorization && vercelExpected) {
      const parts = authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === vercelExpected) ok = true;
    }

    if (!ok) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const count = await this.autoLogoutService.performDailyAggregation();
      return { ok: true, closedSessions: count };
    } catch (err) {
      throw new HttpException('Daily aggregation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('metrics')
  async getMetrics(
    @Headers('x-internal-cron-secret') internalSecret?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const internalExpected = process.env.INTERNAL_CRON_SECRET;
    const vercelExpected = process.env.CRON_SECRET || process.env.INTERNAL_CRON_SECRET;

    if (!internalExpected && !vercelExpected) {
      throw new HttpException('Internal cron secret not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let ok = false;
    if (internalSecret && internalExpected && internalSecret === internalExpected) ok = true;
    if (authorization && vercelExpected) {
      const parts = authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === vercelExpected) ok = true;
    }

    if (!ok) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const metrics = this.autoLogoutService.getMetrics();
      return { ok: true, metrics };
    } catch (err) {
      throw new HttpException('Failed to fetch metrics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
