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
import { MESSAGES } from '../constants/messages';

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
        throw new HttpException({
          message: 'Invalid username or password. Please check your credentials and try again.',
          error: 'INVALID_CREDENTIALS'
        }, HttpStatus.UNAUTHORIZED);
      }

      // Verify password using bcrypt
      const isPasswordValid = await this.passwordService.comparePassword(loginDto.password, user.password);
      console.log('Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('Invalid password');
        throw new HttpException({
          message: 'Invalid username or password. Please check your credentials and try again.',
          error: 'INVALID_CREDENTIALS'
        }, HttpStatus.UNAUTHORIZED);
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
          throw new HttpException({
            message: 'You are not authorized to login from this device. Please use your assigned device or contact your administrator.',
            error: 'DEVICE_NOT_ASSIGNED',
            assignedDeviceId: user.assignedDeviceId,
            requestedDeviceId: loginDto.deviceId
          }, HttpStatus.FORBIDDEN);
        }

        // If device is unassigned, employee cannot login
        if (!user.assignedDeviceId) {
          console.log('Device unassigned and user is employee');
          throw new HttpException({
            message: 'No device has been assigned to your account. Please contact your administrator to assign a device.',
            error: 'NO_DEVICE_ASSIGNED'
          }, HttpStatus.FORBIDDEN);
        }
      }

      // Role-based location validation
      // Determine whether to perform location validation for this login.
      // Priority: explicit request flag (loginDto.location.location_Status) -> user setting -> default true for employees
      let doLocationValidation = false;
      if (user.role === 'admin') {
        doLocationValidation = false;
        console.log('Admin user - skipping location validation');
      } else {
        // If client explicitly provided a flag, respect it
        const reqFlag = loginDto.location && (loginDto.location as any).location_Status;
        if (reqFlag === true) {
          doLocationValidation = true;
        } else if (reqFlag === false) {
          doLocationValidation = false;
        } else {
          // Fallback to user preference (if set) otherwise default to true for employees
          doLocationValidation = user.locationValidationRequired !== false;
        }
      }

      if (doLocationValidation) {
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
            const msg = MESSAGES.LOCATION.ALLOCATED_LOCATION_NOT_FOUND;
            throw new HttpException({
              message: msg.message,
              error: msg.error,
              allocatedLocationId: user.allocatedLocationId
            }, msg.status);
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
            const msg = MESSAGES.LOCATION.NOT_WITHIN_ALLOCATED_LOCATION(allocatedLocation.name, proximityMeters);
            throw new HttpException({
              message: msg.message,
              error: msg.error,
              allocatedLocation: {
                name: allocatedLocation.name,
                lat: allocatedLocation.coords.coordinates[1],
                lon: allocatedLocation.coords.coordinates[0]
              },
              requiredProximityMeters: proximityMeters
            }, msg.status);
          }
          
          console.log('Employee within allocated location proximity - access granted');
        } else {
          console.log('Employee has no allocated location - checking general company locations');
          
          // Fallback to general company location check if no allocated location
          const allowedLocations = await this.locationModel.find({ companyId: user.companyId });
          console.log('Found general locations for company:', allowedLocations.length);
          
          if (allowedLocations.length === 0) {
            console.log('No locations configured for company:', user.companyId);
            const msg = MESSAGES.LOCATION.NO_LOCATIONS_CONFIGURED;
            throw new HttpException({
              message: msg.message,
              error: msg.error,
              companyId: user.companyId
            }, msg.status);
          }

          console.log('Allowed general locations:', allowedLocations.map(loc => ({ 
            name: loc.name, 
            coords: loc.coords.coordinates, 
            radius: loc.radiusMeters 
          })));
          
          if (!isWithinAllowedLocation(userLocation, allowedLocations)) {
            console.log('Employee not within any allowed general location');
            const msg = MESSAGES.LOCATION.LOCATION_NOT_ALLOWED;
            throw new HttpException({
              message: msg.message,
              error: msg.error,
              allowedLocations: allowedLocations.map(loc => ({
                name: loc.name,
                lat: loc.coords.coordinates[1],
                lon: loc.coords.coordinates[0],
                radiusMeters: loc.radiusMeters
              }))
            }, msg.status);
          }
          
          console.log('Employee within general company location - access granted');
        }
      } else {
        console.log('Location validation skipped for this login request (location_Status=false or user setting)');
      }

      console.log('Location check passed, checking existing sessions');

      // Check for existing active sessions (employees only)
      const currentTime = new Date();
  const heartbeatTimeoutMinutes = this.configService.get<number>('heartbeatMinutes') || 5;
  const heartbeatGraceFactor = this.configService.get<number>('heartbeatGraceFactor') || 2;
  const heartbeatTimeoutMs = heartbeatTimeoutMinutes * heartbeatGraceFactor * 60 * 1000;
      
      if (user.role !== 'admin') {
        // Find any active sessions for this user
        const existingActiveSession = await this.sessionModel.findOne({
          userId: user._id,
          status: 'active'
        });

        if (existingActiveSession) {
          // Defensive: if lastHeartbeat is missing, treat session as stale
          const lastHb = existingActiveSession.lastHeartbeat;
          if (!lastHb) {
            console.log(`User ${user.username} has active session without lastHeartbeat, auto-logging out.`);
            await this.sessionModel.updateOne(
              { _id: existingActiveSession._id },
              { 
                logoutAt: currentTime,
                status: 'heartbeat_timeout'
              }
            );
          } else {
            // Check if heartbeat is still valid (within timeout window)
            const timeSinceLastHeartbeat = currentTime.getTime() - lastHb.getTime();

            if (timeSinceLastHeartbeat < heartbeatTimeoutMs) {
              // Session is still active with valid heartbeat - reject login
              console.log(`User ${user.username} has active session with valid heartbeat. Rejecting login.`);
              throw new HttpException({
                message: 'You already have an active session. Please logout from your other device first or wait for the session to expire.',
                error: 'ACTIVE_SESSION_EXISTS',
                sessionId: existingActiveSession._id,
                deviceId: existingActiveSession.deviceId,
                loginAt: existingActiveSession.loginAt,
                lastHeartbeat: existingActiveSession.lastHeartbeat
              }, HttpStatus.CONFLICT);
            } else {
              // Heartbeat has timed out - auto-logout the stale session
              console.log(`User ${user.username} has stale session (no heartbeat for ${Math.floor(timeSinceLastHeartbeat / 1000)}s). Auto-logging out.`);
              await this.sessionModel.updateOne(
                { _id: existingActiveSession._id },
                { 
                  logoutAt: currentTime,
                  status: 'heartbeat_timeout'
                }
              );
            }
          }
        }
      } else {
        console.log('Admin user - skipping active session restriction');
      }

      // Create new session
      const sessionData: any = {
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
      };
      
      // Only add companyId if user has one (not for standalone admins)
      if (user.companyId) {
        sessionData.companyId = user.companyId;
      }
      
      const session = new this.sessionModel(sessionData);

      await session.save();
      const sessionId = String(session._id);
      console.log('Session created successfully:', sessionId);

      // Final verification: ensure user has only one active session (employees only)
      if (user.role !== 'admin') {
        const finalActiveCount = await this.sessionModel.countDocuments({
          userId: user._id,
          status: 'active'
        });

        if (finalActiveCount !== 1) {
          console.error(`CRITICAL: User ${user.username} has ${finalActiveCount} active sessions after login!`);
        } else {
          console.log(`SUCCESS: User ${user.username} has exactly 1 active session`);
        }
      } else {
        console.log('Admin user - skipping post-login single active session check');
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
        expiresIn: sessionTimeoutHours * 3600, // in seconds
        companyId: user.companyId || null, // Include companyId for frontend routing
        role: user.role // Include role for authorization
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