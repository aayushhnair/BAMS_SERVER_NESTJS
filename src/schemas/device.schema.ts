import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

@Schema()
export class Device {
  @Prop({ required: true, unique: true })
  deviceId: string;

  @Prop({ required: true })
  serial: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  companyId: string;

  @Prop()
  assignedTo?: string;

  @Prop({ default: () => new Date() })
  lastSeen: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);

// Create indexes for optimal query performance
DeviceSchema.index({ deviceId: 1 }, { unique: true }); // Primary device lookup
DeviceSchema.index({ companyId: 1 }); // Company device queries
DeviceSchema.index({ assignedTo: 1 }, { sparse: true }); // Assignment tracking