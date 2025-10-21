import { Controller, Post, Get, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Location, LocationDocument } from '../schemas/location.schema';
import { Company, CompanyDocument } from '../schemas/company.schema';
import { CreateLocationDto } from '../dto/admin.dto';

@Controller('api/locations')
export class LocationsController {
  constructor(
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  @Post()
  async createLocation(@Body() createLocationDto: CreateLocationDto) {
    try {
      const location = new this.locationModel({
        companyId: createLocationDto.companyId,
        name: createLocationDto.name,
        coords: {
          type: 'Point',
          coordinates: [createLocationDto.lon, createLocationDto.lat]
        },
        radiusMeters: createLocationDto.radiusMeters
      });

      await location.save();

      return {
        ok: true,
        locationId: location._id,
        message: 'Location created successfully'
      };
    } catch (error) {
      throw new HttpException('Failed to create location', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getLocations(@Query('companyId') companyId?: string) {
    try {
      const filter = companyId ? { companyId } : {};
      const locations = await this.locationModel.find(filter);

      return {
        ok: true,
        locations: locations.map(loc => ({
          id: loc._id,
          companyId: loc.companyId,
          name: loc.name,
          lat: loc.coords.coordinates[1],
          lon: loc.coords.coordinates[0],
          radiusMeters: loc.radiusMeters
        }))
      };
    } catch (error) {
      throw new HttpException('Failed to fetch locations', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  /**
   * PUT /api/locations/update
   * Updates an existing location
   */
  @Post('update')
  async updateLocation(@Body() updateDto: { 
    id: string; 
    name?: string; 
    lat?: number; 
    lon?: number; 
    radiusMeters?: number;
    companyId?: string;
  }) {
    try {
      if (!updateDto.id) {
        throw new HttpException({
          message: 'Location ID is required for update.',
          error: 'LOCATION_ID_REQUIRED'
        }, HttpStatus.BAD_REQUEST);
      }

      const location = await this.locationModel.findById(updateDto.id);
      
      if (!location) {
        throw new HttpException({
          message: 'Location not found. It may have been deleted.',
          error: 'LOCATION_NOT_FOUND',
          locationId: updateDto.id
        }, HttpStatus.NOT_FOUND);
      }

      // Build update object
      const updateData: any = {};
      
      if (updateDto.name !== undefined) {
        updateData.name = updateDto.name;
      }
      
      if (updateDto.companyId !== undefined) {
        updateData.companyId = updateDto.companyId;
      }
      
      if (updateDto.radiusMeters !== undefined) {
        if (updateDto.radiusMeters < 0) {
          throw new HttpException({
            message: 'Radius cannot be negative.',
            error: 'INVALID_RADIUS'
          }, HttpStatus.BAD_REQUEST);
        }
        updateData.radiusMeters = updateDto.radiusMeters;
      }
      
      // Update coordinates if provided
      if (updateDto.lat !== undefined && updateDto.lon !== undefined) {
        if (updateDto.lat < -90 || updateDto.lat > 90) {
          throw new HttpException({
            message: 'Latitude must be between -90 and 90 degrees.',
            error: 'INVALID_LATITUDE'
          }, HttpStatus.BAD_REQUEST);
        }
        if (updateDto.lon < -180 || updateDto.lon > 180) {
          throw new HttpException({
            message: 'Longitude must be between -180 and 180 degrees.',
            error: 'INVALID_LONGITUDE'
          }, HttpStatus.BAD_REQUEST);
        }
        updateData.coords = {
          type: 'Point',
          coordinates: [updateDto.lon, updateDto.lat]
        };
      }

      if (Object.keys(updateData).length === 0) {
        throw new HttpException({
          message: 'No fields provided to update.',
          error: 'NO_UPDATE_FIELDS'
        }, HttpStatus.BAD_REQUEST);
      }

      const updatedLocation = await this.locationModel.findByIdAndUpdate(
        updateDto.id,
        updateData,
        { new: true }
      );

      if (!updatedLocation) {
        throw new HttpException({
          message: 'Failed to update location. Location not found.',
          error: 'UPDATE_FAILED'
        }, HttpStatus.NOT_FOUND);
      }

      return {
        ok: true,
        message: 'Location updated successfully',
        location: {
          id: updatedLocation._id,
          companyId: updatedLocation.companyId,
          name: updatedLocation.name,
          lat: updatedLocation.coords.coordinates[1],
          lon: updatedLocation.coords.coordinates[0],
          radiusMeters: updatedLocation.radiusMeters
        }
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException({
        message: 'Failed to update location. Please try again.',
        error: 'UPDATE_FAILED'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/locations/delete
   * Deletes a location by its ID
   */
  @Post('delete')
  async deleteLocation(@Body('id') id: string) {
    try {
      if (!id) {
        throw new HttpException({
          message: 'Location ID is required for deletion.',
          error: 'LOCATION_ID_REQUIRED'
        }, HttpStatus.BAD_REQUEST);
      }
      
      const result = await this.locationModel.deleteOne({ _id: id });
      
      if (result.deletedCount === 0) {
        throw new HttpException({
          message: 'Location not found. It may have already been deleted.',
          error: 'LOCATION_NOT_FOUND',
          locationId: id
        }, HttpStatus.NOT_FOUND);
      }
      
      return { 
        ok: true, 
        message: 'Location deleted successfully', 
        locationId: id 
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException({
        message: 'Failed to delete location. Please try again.',
        error: 'DELETE_FAILED'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}