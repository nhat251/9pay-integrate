import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  NinePayRecurringClient,
  NinePayGatewayError,
} from "../core/recurring-client";
import type {
  NinePayCitRequest,
  NinePayCitResult,
  NinePayInquiryResult,
  NinePayMitRequest,
  NinePayMitResult,
} from "../core/recurring-client";

function toHttpException(error: unknown): never {
  if (error instanceof NinePayGatewayError) {
    throw new InternalServerErrorException({
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

/**
 * NestJS adapter around the framework-agnostic NinePayRecurringClient.
 * Reads credentials from ConfigService and surfaces gateway failures as
 * InternalServerErrorException, so it is a drop-in replacement for a
 * hand-rolled adapter. Wire it behind your own port token:
 *
 *   { provide: NINEPAY_RECURRING_CLIENT_PORT_OUT, useClass: NinePayRecurringClientAdapter }
 */
@Injectable()
export class NinePayRecurringClientAdapter {
  private readonly client: NinePayRecurringClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new NinePayRecurringClient({
      baseUrl: this.configService.get<string>("NINEPAY_BASE_URL"),
      merchantKey: this.configService.get<string>("NINEPAY_MERCHANT_KEY"),
      secretKey: this.configService.get<string>("NINEPAY_SECRET_KEY"),
      returnUrl: this.configService.get<string>("NINEPAY_RETURN_URL"),
    });
  }

  async createCit(input: NinePayCitRequest): Promise<NinePayCitResult> {
    try {
      return await this.client.createCit(input);
    } catch (error) {
      toHttpException(error);
    }
  }

  async chargeMit(input: NinePayMitRequest): Promise<NinePayMitResult> {
    try {
      return await this.client.chargeMit(input);
    } catch (error) {
      toHttpException(error);
    }
  }

  async inquire(reference: string): Promise<NinePayInquiryResult> {
    try {
      return await this.client.inquire(reference);
    } catch (error) {
      toHttpException(error);
    }
  }

  async deleteCardToken(token: string): Promise<{ succeeded: boolean }> {
    try {
      return await this.client.deleteCardToken(token);
    } catch (error) {
      toHttpException(error);
    }
  }
}
