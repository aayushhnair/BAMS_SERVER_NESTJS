import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema()
export class Session {
  @Prop({ required: false }) // Optional for admin users who don't have companyId
  companyId?: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true, default: () => new Date() })
  loginAt: Date;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    accuracy: {
      type: Number,
      required: true
    }
  })
  loginLocation: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
    accuracy: number;
  };

  @Prop()
  logoutAt?: Date;

  @Prop({ required: true, enum: ['active', 'logged_out', 'auto_logged_out', 'expired', 'heartbeat_timeout'], default: 'active' })
  status: string;

  @Prop({ default: () => new Date() })
  lastHeartbeat: Date;

  @Prop({ required: false })
  // workedSeconds stores number of seconds counted as "worked" for this session record.
  workedSeconds?: number;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Create indexes for optimal query performance
SessionSchema.index({ userId: 1, loginAt: -1 }); // User session history
SessionSchema.index({ companyId: 1, loginAt: -1 }); // Company attendance queries
SessionSchema.index({ userId: 1, status: 1 }); // Active session checks
SessionSchema.index({ status: 1, lastHeartbeat: 1 }); // Auto-logout maintenance
SessionSchema.index({ loginAt: 1 }); // Date range queries
SessionSchema.index({ deviceId: 1 }); // Device tracking