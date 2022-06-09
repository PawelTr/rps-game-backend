import { Injectable } from '@nestjs/common';
import { SignEnum, UserDto } from '../dto/User.dto';

@Injectable()
export class GameService {
  private winTable = {
    [SignEnum.ROCK]: SignEnum.SCISSORS,
    [SignEnum.PAPER]: SignEnum.ROCK,
    [SignEnum.SCISSORS]: SignEnum.PAPER,
  };

  private signs = ['rock', 'paper', 'scissors'];

  setRandomSign(clients: Array<UserDto>): Array<UserDto> {
    clients.forEach((client: UserDto) => {
      const random = Math.floor(Math.random() * 3);
      client.sign = this.signs[random];
    });
    return clients;
  }

  setLoosers(clients: Array<UserDto>): Array<UserDto> {
    const signs = [];
    this.signs.forEach((sign: SignEnum) => {
      if (clients.some((client: UserDto) => client.sign === sign)) {
        signs.push(sign);
      }
    });

    if (signs.length === 2) {
      const looserSign =
        this.winTable[signs[0]] === signs[1] ? signs[1] : signs[0];
      clients.forEach((client: UserDto) => {
        client.isLost = client.sign === looserSign;
      });

      return clients;
    } else {
      return clients;
    }
  }
}
