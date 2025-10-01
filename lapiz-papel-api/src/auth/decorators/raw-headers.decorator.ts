import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";

export const RawHeaders = createParamDecorator(
    (data:string, ctx:ExecutionContext) => {
        
        const request = ctx.switchToHttp().getRequest()
        
        const rawHeaders = request.rawHeaders

        return rawHeaders
    }
)