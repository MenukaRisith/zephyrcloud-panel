import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class JsonSerializerInterceptor implements NestInterceptor {
    public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(map((data) => this.transform(data)));
    }

    private transform(data: any): any {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'bigint') {
            return data.toString();
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.transform(item));
        }

        if (typeof data === 'object') {
            // Pass through Date objects, let JSON.stringify handle them
            if (data instanceof Date) {
                return data;
            }

            const newObj: any = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    newObj[key] = this.transform(data[key]);
                }
            }
            return newObj;
        }

        return data;
    }
}
