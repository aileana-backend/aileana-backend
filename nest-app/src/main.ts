import '@/instrument';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * Initailize global validations
   */
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist all properties that are not define in request
      whitelist: true,
      // Throws an error when a property not define in request body is provided by user
      forbidNonWhitelisted: true,
      // Transform the incoming request into the instance of a DTO Class.
      transform: true,
    }),
  );

  // Enable CORS for all origins
  app.enableCors({
    origin: true, // allows all origins
    credentials: true,
  });

  // Set global prefix for API routes
  app.setGlobalPrefix('api/v1');

  // interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

  // exception filters
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
