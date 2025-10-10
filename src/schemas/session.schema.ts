import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema()
export class Session {
  @Prop({ required: true })
  companyId: string;

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

  @Prop({ required: true, enum: ['active', 'logged_out', 'auto_logged_out'], default: 'active' })
  status: string;

  @Prop({ default: () => new Date() })
  lastHeartbeat: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Create compound index
SessionSchema.index({ userId: 1, loginAt: -1 });