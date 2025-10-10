import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';

export interface AuthenticatedRequest extends Request {
  user?: UserDocument;
  session?: SessionDocument;
  company?: CompanyDocument;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Skip auth for certain routes
      const skipAuthRoutes = [
        '/api/auth/login',
        '/api/companies', // Allow company creation without auth
        '/api/device/register',
        '/api/heartbeat'
      ];

      const isSkipRoute = skipAuthRoutes.some(route => 
        req.path.startsWith(route) && (req.method === 'POST' || req.method === 'GET')
      );

      if (isSkipRoute) {
        return next();
      }

      // Extract authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Authorization token required');
      }

      const sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate session
      const session = await this.sessionModel.findById(sessionId);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      if (session.status !== 'active') {
        throw new UnauthorizedException('Session is not active');
      }

      // Check session timeout
      const now = new Date();
      const lastActivity = session.lastHeartbeat || session.loginAt;
      const sessionTimeoutHours = 12; // Default timeout
      const timeoutMs = sessionTimeoutHours * 60 * 60 * 1000;

      if (now.getTime() - lastActivity.getTime() > timeoutMs) {
        // Mark session as expired
        await this.sessionModel.updateOne(
          { _id: sessionId },
          { status: 'expired' }
        );
        throw new UnauthorizedException('Session has expired');
      }

      // Get user information
      const user = await this.userModel.findById(session.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Get company information
      const company = await this.companyModel.findById(user.companyId);
      if (!company) {
        throw new UnauthorizedException('Company not found');
      }

      // Attach user, session, and company to request
      req.user = user;
      req.session = session;
      req.company = company;

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}