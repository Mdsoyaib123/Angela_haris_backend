import { JwtPayload } from '../module/auth/strategy/jwt.strategy';

declare global {
  namespace Express {
    interface User extends JwtPayload {}
  }
}
