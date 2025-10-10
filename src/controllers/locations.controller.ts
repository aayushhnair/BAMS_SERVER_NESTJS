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
}