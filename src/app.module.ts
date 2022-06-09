import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketGateway } from './socket.gateway';
import { GameService } from './game/game.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, SocketGateway, GameService],
})
export class AppModule {}
