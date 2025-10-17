import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Location, LocationDocument } from '../schemas/location.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { LoginDto, LogoutDto } from '../dto/auth.dto';
import { isWithinAllowedLocation, isWithinAllocatedLocation } from '../utils/location.utils';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../services/password.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private configService: ConfigService,
    private passwordService: PasswordService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log('Login attempt for username:', loginDto.username);
      
      // Find user by username
      const user = await this.userModel.findOne({ username: loginDto.username });
      console.log('User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        console.log('User not found');
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      // Verify password using bcrypt
      const isPasswordValid = await this.passwordService.comparePassword(loginDto.password, user.password);
      console.log('Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('Invalid password');
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      console.log('User company:', user.companyId, 'Device requested:', loginDto.deviceId, 'User role:', user.role);

      // Role-based device assignment validation
      if (user.role === 'admin') {
        console.log('Admin user - skipping device assignment validation');
        // Admins can login from any device
      } else {
        // Employee users must have assigned device
        if (user.assignedDeviceId && user.assignedDeviceId !== loginDto.deviceId) {
          console.log('Device not assigned - user device:', user.assignedDeviceId, 'requested device:', loginDto.deviceId);
          return { ok: false, error: 'NOT_ASSIGNED' };
        }

        // If device is unassigned, employee cannot login
        if (!user.assignedDeviceId) {
          console.log('Device unassigned and user is employee');
          return { ok: false, error: 'NOT_ASSIGNED' };
        }
      }

      // Role-based location validation
      if (user.role === 'admin') {
        console.log('Admin user - skipping location validation');
        // Admins can login from anywhere
      } else {
        // Employee users must validate location
        const userLocation = { lat: loginDto.location.lat, lon: loginDto.location.lon };
        console.log('Employee user location:', userLocation);
        
        // Check if user has an allocated location
        if (user.allocatedLocationId) {
          console.log('Employee has allocated location:', user.allocatedLocationId);
          
          // Find the user's specific allocated location
          const allocatedLocation = await this.locationModel.findById(user.allocatedLocationId);
          
          if (!allocatedLocation) {
            console.log('Allocated location not found:', user.allocatedLocationId);
            return { ok: false, error: 'ALLOCATED_LOCATION_NOT_FOUND' };
          }
          
          // Get proximity setting from config (default 100m)
          const proximityMeters = this.configService.get<number>('locationProximityMeters') || 100;
          console.log('Checking proximity within:', proximityMeters, 'meters');
          console.log('Allocated location:', { 
            name: allocatedLocation.name, 
            coords: allocatedLocation.coords.coordinates 
          });
          
          // Check if user is within 100m of their allocated location
          if (!isWithinAllocatedLocation(userLocation, allocatedLocation, proximityMeters)) {
            console.log('Employee not within allocated location proximity');
            return { ok: false, error: 'NOT_WITHIN_ALLOCATED_LOCATION' };
          }
          
          console.log('Employee within allocated location proximity - access granted');
        } else {
          console.log('Employee has no allocated location - checking general company locations');
          
          // Fallback to general company location check if no allocated location
          const allowedLocations = await this.locationModel.find({ companyId: user.companyId });
          console.log('Found general locations for company:', allowedLocations.length);
          
          if (allowedLocations.length === 0) {
            console.log('No locations configured for company:', user.companyId);
            return { ok: false, error: 'NO_LOCATIONS_CONFIGURED' };
          }

          console.log('Allowed general locations:', allowedLocations.map(loc => ({ 
            name: loc.name, 
            coords: loc.coords.coordinates, 
            radius: loc.radiusMeters 
          })));
          
          if (!isWithinAllowedLocation(userLocation, allowedLocations)) {
            console.log('Employee not within any allowed general location');
            return { ok: false, error: 'LOCATION_NOT_ALLOWED' };
          }
          
          console.log('Employee within general company location - access granted');
        }
      }

      console.log('Location check passed, creating session');

      // Use atomic operation to ensure no race conditions
      const currentTime = new Date();
      
      // First, forcefully logout ALL existing active sessions for this user
      // This is more aggressive and handles race conditions better
      const logoutResult = await this.sessionModel.updateMany(
        { 
          userId: user._id,
          status: 'active'
        },
        { 
          logoutAt: currentTime,
          status: 'auto_logged_out'
        }
      );

      if (logoutResult.modifiedCount > 0) {
        console.log(`Forcefully logged out ${logoutResult.modifiedCount} existing active sessions for user ${user.username}`);
      }

      // Wait a small moment to ensure the update is completed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no active sessions exist (double-check for race conditions)
      const remainingActiveSessions = await this.sessionModel.countDocuments({
        userId: user._id,
        status: 'active'
      });

      if (remainingActiveSessions > 0) {
        console.error(`WARNING: Found ${remainingActiveSessions} active sessions after logout attempt for user ${user.username}`);
        // Force another cleanup
        await this.sessionModel.updateMany(
          { 
            userId: user._id,
            status: 'active'
          },
          { 
            logoutAt: currentTime,
            status: 'auto_logged_out'
          }
        );
      }

      // Create new session
      const session = new this.sessionModel({
        companyId: user.companyId,
        userId: user._id,
        deviceId: loginDto.deviceId,
        loginAt: currentTime,
        loginLocation: {
          type: 'Point',
          coordinates: [loginDto.location.lon, loginDto.location.lat],
          accuracy: loginDto.location.accuracy
        },
        status: 'active',
        lastHeartbeat: currentTime
      });

      await session.save();
      const sessionId = String(session._id);
      console.log('Session created successfully:', sessionId);

      // Final verification: ensure user has only one active session
      const finalActiveCount = await this.sessionModel.countDocuments({
        userId: user._id,
        status: 'active'
      });

      if (finalActiveCount !== 1) {
        console.error(`CRITICAL: User ${user.username} has ${finalActiveCount} active sessions after login!`);
      } else {
        console.log(`SUCCESS: User ${user.username} has exactly 1 active session`);
      }

      // Update device lastSeen
      await this.deviceModel.updateOne(
        { deviceId: loginDto.deviceId },
        { lastSeen: new Date() }
      );

      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 12;

      return {
        ok: true,
        sessionId: sessionId,
        expiresIn: sessionTimeoutHours * 3600 // in seconds
      };
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Login failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('verify-session')
  async verifySession(@Body() body: { sessionId: string }) {
    try {
      const session = await this.sessionModel.findById(body.sessionId);
      
      if (!session) {
        return { 
          ok: false, 
          valid: false,
          error: 'Session not found' 
        };
      }

      if (session.status !== 'active') {
        return { 
          ok: false, 
          valid: false,
          error: 'Session is not active',
          status: session.status
        };
      }

      // Get user details
      const user = await this.userModel.findById(session.userId).select('-password');
      
      if (!user) {
        return { 
          ok: false, 
          valid: false,
          error: 'User not found' 
        };
      }

      // Calculate session age and expiry
      const sessionTimeoutHours = this.configService.get<number>('sessionTimeoutHours') || 12;
      const sessionAgeMs = Date.now() - session.loginAt.getTime();
      const sessionAgeHours = sessionAgeMs / (1000 * 60 * 60);
      const isExpired = sessionAgeHours > sessionTimeoutHours;

      if (isExpired) {
        // Auto-expire the session
        await this.sessionModel.updateOne(
          { _id: body.sessionId },
          { 
            logoutAt: new Date(),
            status: 'expired'
          }
        );

        return { 
          ok: false, 
          valid: false,
          error: 'Session expired',
          expiredAt: new Date().toISOString()
        };
      }

      // Calculate time since last heartbeat
      const timeSinceLastHeartbeatMs = session.lastHeartbeat 
        ? Date.now() - session.lastHeartbeat.getTime() 
        : 0;

      return { 
        ok: true, 
        valid: true,
        session: {
          sessionId: String(session._id),
          userId: String(session.userId),
          deviceId: session.deviceId,
          loginAt: session.loginAt,
          lastHeartbeat: session.lastHeartbeat,
          timeSinceLastHeartbeatMs, // Time elapsed since last heartbeat
          status: session.status
        },
        user: {
          _id: String(user._id),
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          companyId: user.companyId
        },
        expiresIn: Math.floor((sessionTimeoutHours * 3600) - (sessionAgeMs / 1000)) // remaining seconds
      };
    } catch (error) {
      console.error('Verify session error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Session verification failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto) {
    try {
      const session = await this.sessionModel.findById(logoutDto.sessionId);
      
      if (!session) {
        throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
      }

      if (session.deviceId !== logoutDto.deviceId) {
        throw new HttpException('Device mismatch', HttpStatus.FORBIDDEN);
      }

      if (session.status !== 'active') {
        throw new HttpException('Session already closed', HttpStatus.BAD_REQUEST);
      }

      // Update session
      await this.sessionModel.updateOne(
        { _id: logoutDto.sessionId },
        { 
          logoutAt: new Date(),
          status: 'logged_out'
        }
      );

      // Update device lastSeen
      await this.deviceModel.updateOne(
        { deviceId: logoutDto.deviceId },
        { lastSeen: new Date() }
      );

      return { ok: true, message: 'Logged out successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Logout failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}