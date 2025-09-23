import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { OmitType } from '@nestjs/mapped-types';

export class SignupDto extends OmitType(CreateUserDto, [
  'city',
  'address',
  'bio',
  'profilePicture',
  'role',
]) {}
