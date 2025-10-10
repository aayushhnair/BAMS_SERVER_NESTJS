import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema()
export class Company {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 'Asia/Kolkata' })
  timezone: string;

  @Prop({
    type: {
      sessionTimeoutHours: { type: Number, default: 12 },
      heartbeatMinutes: { type: Number, default: 5 }
    },
    default: {
      sessionTimeoutHours: 12,
      heartbeatMinutes: 5
    }
  })
  settings: {
    sessionTimeoutHours: number;
    heartbeatMinutes: number;
  };
}

export const CompanySchema = SchemaFactory.createForClass(Company);