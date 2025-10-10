import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LocationDocument = Location & Document;

@Schema()
export class Location {
  @Prop({ required: true })
  companyId: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      index: '2dsphere'
    }
  })
  coords: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ required: true })
  radiusMeters: number;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

// Create 2dsphere index for geospatial queries
LocationSchema.index({ coords: '2dsphere' });