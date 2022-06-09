export interface UserDto {
  userName: string;
  roomName: string;
  isReady: boolean;
  isLost: boolean;
  sign?: string;
}

export enum SignEnum {
  ROCK = 'rock',
  PAPER = 'paper',
  SCISSORS = 'scissors',
}
