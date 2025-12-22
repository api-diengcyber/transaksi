import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const GetStore = createParamDecorator(
  (data: undefined, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest();
    
    const storeId = request.headers['x-store-id'];

    if (!storeId) {
      return null;
    }

    return storeId;
  },
);