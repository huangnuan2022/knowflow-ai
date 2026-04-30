import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController],
  imports: [PrismaModule],
  providers: [MessagesService],
})
export class MessagesModule {}
