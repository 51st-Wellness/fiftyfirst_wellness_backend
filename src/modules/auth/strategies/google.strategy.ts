import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from 'src/config/config.service';
import { AuthService } from '../auth.service';
import { ENV } from 'src/config/env.enum';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get(ENV.GOOGLE_CLIENT_ID),
      clientSecret: configService.get(ENV.GOOGLE_CLIENT_SECRET),
      callbackURL: configService.get(ENV.GOOGLE_REDIRECT_URI), // e.g., http://localhost:3000/auth/google/callback
      scope: ['email', 'profile'],
      passReqToCallback: true, // Enable access to request object for state handling
    });
  }

  // Validate Google profile and return user data
  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { name, emails, photos, id: googleId } = profile;
      const userEmail = emails?.[0]?.value;
      const userFirstName = name?.givenName;
      const userLastName = name?.familyName;
      const userProfilePhoto = photos?.[0]?.value; // Profile photo URL from Google

      if (!userEmail) {
        return done(new Error('No email found in Google profile'), false);
      }

      const user = await this.authService.validateUserWithGoogle(
        userEmail,
        userFirstName || '',
        userLastName || '',
        googleId,
        userProfilePhoto,
      );

      // Attach origin information from state for callback redirect
      const userWithOrigin = {
        ...user,
        _redirectOrigin: req.query.state, // Preserve the origin from state
      };

      return done(null, userWithOrigin);
    } catch (error) {
      return done(error, false);
    }
  }
}
