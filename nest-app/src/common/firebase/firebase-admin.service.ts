import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import firebase from 'firebase-admin';

/**
 * Service to manage Firebase Admin SDK initialization and provide access to the Firebase instance.
 */

@Injectable()
export class FirebaseAdminService {
  public app: firebase.app.App;

  constructor(protected readonly configService: ConfigService) {
    if (!firebase.apps.length) {
      const serviceAccount = JSON.parse(
        Buffer.from(
          this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT') as string,
          'base64',
        ).toString('utf8'),
      );

      this.app = firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
      });
    } else {
      this.app = firebase.app();
    }
  }
}
