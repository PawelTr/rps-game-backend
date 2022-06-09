import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game/game.service';
import { UserDto } from './dto/User.dto';

@WebSocketGateway({ cors: true })
export class SocketGateway {
  constructor(private readonly gameService: GameService) {}

  private startedRooms = new Set();

  @WebSocketServer()
  server: Server;

  // @SubscribeMessage('message')
  // handleMessage(@MessageBody() message, @ConnectedSocket() socket: Socket) {
  //   this.server.to(message.roomName).emit('message', message);
  // }

  @SubscribeMessage('joinRoom')
  handleJoin(@MessageBody() body, @ConnectedSocket() socket: Socket) {
    if (this.startedRooms.has(body.roomName)) {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    if (this.isRoomExists(body.roomName)) {
      socket.data.userName = body.userName;
      socket.data.roomName = body.roomName;
      socket.data.isAdmin = false;
      socket.data.isReady = false;
      socket.data.isLost = false;
      body.isAdmin = false;
      body.isReady = false;

      let clients = this.getClients(body.roomName);

      if (!clients) {
        socket.emit('error', { message: "room doesn't exists" });
        return;
      }

      if (clients.find((user) => body.userName === user.userName)) {
        socket.emit('error', { message: 'user already exist' });
        return;
      }

      socket.join(body.roomName);
      socket.emit('roomJoined', body);
      clients = this.getClients(body.roomName);
      clients.forEach((client) => delete client.sign);
      this.handleReady(socket, false);
      this.server.to(body.roomName).emit('clientsList', clients);
    } else {
      socket.emit('error', { message: "room doesn't exists" });
    }
  }

  @SubscribeMessage('userReady')
  handleReady(@ConnectedSocket() socket: Socket, @MessageBody() body) {
    socket.data.isReady = body;

    const clients = this.getClients(socket.data.roomName);
    if (!clients.length) {
      socket.emit('error', { message: "room doesn't exists" });
      return;
    }

    clients.forEach((client) => delete client.sign);
    const isEverybodyReady = clients.every((client) => client.isReady === true);
    this.server
      .to(socket.data.roomName)
      .emit('everybodyReady', isEverybodyReady);
    this.server.to(socket.data.roomName).emit('clientsList', clients);
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() socket: Socket) {
    if (socket.data.isAdmin) {
      this.server.to(socket.data.roomName).emit('roomClosed');
    } else {
      const clients = this.getClients(socket.data.roomName);
      if (!clients) {
        socket.emit('error', { message: "room doesn't exists" });
        return;
      }

      clients.forEach((client) => delete client.sign);
      this.server.to(socket.data.roomName).emit('clientsList', clients);
    }
  }

  @SubscribeMessage('createRoom')
  handleCreate(@MessageBody() body, @ConnectedSocket() socket: Socket) {
    if (this.isRoomExists(body.roomName)) {
      socket.emit('error', { message: 'room already exists' });
      return;
    }

    socket.data.userName = body.userName;
    socket.data.roomName = body.roomName;
    socket.data.isReady = false;
    socket.data.isAdmin = true;
    socket.data.isLost = false;
    body.isAdmin = true;
    body.isReady = false;
    socket.join(body.roomName);
    socket.emit('roomCreated', body);
  }

  @SubscribeMessage('setRandomSign')
  handleSetRandomSign(@ConnectedSocket() socket: Socket) {
    let clients = this.getClients(socket.data.roomName);
    clients = this.gameService.setRandomSign(clients);

    this.server.to(socket.data.roomName).emit('clientsList', clients);
  }

  @SubscribeMessage('start')
  handleStart(@ConnectedSocket() socket: Socket) {
    this.startedRooms.add(socket.data.roomName);
  }

  @SubscribeMessage('setSign')
  handleSetSign(@ConnectedSocket() socket: Socket, @MessageBody() body) {
    socket.data.sign = body.sign;
    socket.emit('userSign', body.sign);

    let clients = this.getClients(socket.data.roomName);
    if (!clients.length) {
      socket.emit('error', { message: "room doesn't exists" });
      return;
    }

    let playersInGame = clients.filter(
      (client: UserDto) => client.isLost === false,
    );
    const lostPlayers = clients.filter((client: UserDto) => client.isLost);

    const isEverybodySetSign = playersInGame.every((client) => client?.sign);

    if (isEverybodySetSign) {
      playersInGame = this.gameService.setLoosers(playersInGame);

      clients = [...lostPlayers, ...playersInGame];
      const winners = clients.filter(
        (client: UserDto) => client.isLost === false,
      );

      this.server.to(socket.data.roomName).emit('clientsList', clients);

      if (winners.length === 1) {
        this.server.to(socket.data.roomName).emit('endGame', winners[0]);
        return;
      }

      setTimeout(() => {
        playersInGame
          .filter((client: UserDto) => client.isLost === false)
          .forEach((client) => delete client.sign);
        clients = [...lostPlayers, ...playersInGame];
        this.server.to(socket.data.roomName).emit('clientsList', clients);
      }, 2000);
    }
  }

  @SubscribeMessage('playAgain')
  handlePlayAgain(@ConnectedSocket() socket: Socket) {
    const clients = this.getClients(socket.data.roomName);
    clients.forEach((client: UserDto) => {
      client.isReady = false;
      client.isLost = false;
      delete client.sign;
    });

    this.startedRooms.delete(socket.data.roomName);
    this.server.to(socket.data.roomName).emit('everybodyReady', false);
    this.server.to(socket.data.roomName).emit('endGame', null);
    this.server.to(socket.data.roomName).emit('clientsList', clients);
  }

  isRoomExists(room: string): boolean {
    return this.server.sockets.adapter.rooms.has(room);
  }

  getClients(roomName: string): Array<any> {
    const clients = [];
    const socketsList = this.server.sockets.adapter.rooms.get(roomName);
    if (socketsList) {
      socketsList.forEach((client) => {
        clients.push(this.server.sockets.sockets.get(client).data);
      });
      return clients;
    }
  }
}
