import type { AxiosResponse } from 'axios';
import cheerio from 'cheerio';
import _ from 'lodash';
import { CookieJar } from 'tough-cookie';
import { Diary } from '../diary/diary';
import type { DiaryListItem } from '../diary/interfaces/diary-list-item';
import type { DiaryListData } from '../diary/interfaces/diary/diary-data';
import type { HomepageData } from '../diary/interfaces/homepage/homepage-data';
import type { LuckyNumber } from '../diary/interfaces/homepage/lucky-number';
import type { ReportingUnit } from '../diary/interfaces/messages/reporting-unit';
import type { ReportingUnitData } from '../diary/interfaces/messages/reporting-unit-data';
import type { Response } from '../diary/interfaces/response';
import type { SerializedClient } from '../diary/interfaces/serialized-client';
import { mapDiaryInfo } from '../diary/mappers/diary-info';
import { mapLuckyNumbers } from '../diary/mappers/lucky-numbers';
import { mapReportingUnits } from '../diary/mappers/reporting-units';
import UnexpectedResponseTypeError from '../errors/unexpected-response-type';
import UnknownSymbolError from '../errors/unknown-symbol';
import {
  checkUserSignUrl, getContentType,
  handleResponse,
  joinUrl,
  loginUrl,
  luckyNumbersUrl,
  notNil,
  parseLoginResponds,
  parseSymbolsXml, reportingUnitsUrl,
  startIndexUrl,
} from '../utils';
import { BaseClient } from './base';
import type { DefaultAjaxPostPayload, GetCredentialsFunction } from './types';

/**
 * API client for SDK.
 */
export class Client extends BaseClient {
  private symbol: {
    value: string;
    urlList: string[];
  } | undefined;

  /**
   * API client for SDK constructor.
   * @param host Default host used by user.
   * @param getCredentials Function to get the user's login info
   * @param cookieJar Use custom CookieJar instead of generating a new one.
   */
  public constructor(
    private readonly host: string,
    private getCredentials: GetCredentialsFunction,
    cookieJar?: CookieJar,
  ) {
    super(cookieJar ?? new CookieJar());
  }

  public setCredentialsFunction(getCredentials: GetCredentialsFunction): void {
    this.getCredentials = getCredentials;
  }

  private static indexEndpointValid(html: string): boolean {
    return html.includes('newAppLink');
  }

  /**
   * Login user to UONET. Uses username and password from getCredentials function
   *
   * Covers region symbol finding.
   * @returns Promise<string[]> List of valid region symbols.
   */
  public async login(): Promise<string[]> {
    const credentials = await this.getCredentials();
    const response = await this.post<string>(
      loginUrl(this.host),
      {
        LoginName: credentials.username,
        Password: credentials.password,
      },
    );

    const xml = parseLoginResponds(response.data);
    const symbols = parseSymbolsXml(xml);

    const symbolFunctions = await Promise.all(
      symbols.map(async (symbol): Promise<string | null> => {
        const currentUrl = checkUserSignUrl(this.host, symbol);
        const payload: DefaultAjaxPostPayload = {
          wa: 'wsignin1.0',
          wresult: xml,
          wctx: currentUrl,
        };
        const { data } = await this.post<string>(currentUrl, payload);
        if (!Client.indexEndpointValid(data)) return null;
        return symbol;
      }),
    );
    return symbolFunctions.filter(notNil);
  }

  public async setSymbol(symbol: string): Promise<void> {
    let html: string;
    try {
      const response = await this.get<string>(startIndexUrl(this.host, symbol));
      html = response.data;
    } catch (error) {
      throw new UnknownSymbolError();
    }
    if (!Client.indexEndpointValid(html)) throw new UnknownSymbolError();
    const $ = cheerio.load(html);
    const urlList = $('.panel.linkownia.pracownik.klient a[href*="uonetplus-uczen"]')
      .toArray()
      .map((element) => $(element).attr('href'))
      .filter(notNil);
    this.symbol = { urlList, value: symbol };
  }

  public getSymbol(): string | undefined {
    return this.symbol?.value;
  }

  public serialize(): SerializedClient {
    return {
      cookieJar: this.cookieJar.serializeSync(),
      symbol: _.cloneDeep(this.symbol),
      host: this.host,
    };
  }

  public static deserialize(
    serialized: SerializedClient,
    getCredentials: GetCredentialsFunction,
  ): Client {
    const client = new Client(
      serialized.host,
      getCredentials,
      CookieJar.deserializeSync(serialized.cookieJar),
    );
    client.symbol = _.cloneDeep(serialized.symbol);
    return client;
  }

  private static validateResponse(response: AxiosResponse): void {
    const headers = response.headers as Record<string, string | undefined>;
    if (getContentType(headers) !== 'application/json') {
      throw new UnexpectedResponseTypeError(
        'application/json',
        headers['Content-Type'],
      );
    }
  }

  public async requestWithAutoLogin<R>(
    func: () => Promise<AxiosResponse<R>>,
  ): Promise<AxiosResponse<R>> {
    try {
      const response = await func();
      Client.validateResponse(response);
      return response;
    } catch {}
    await this.login();
    const response = await func();
    Client.validateResponse(response);
    return response;
  }

  public async getDiaryList(): Promise<DiaryListItem[]> {
    if (this.symbol === undefined) throw new UnknownSymbolError();
    const results = await Promise.all(this.symbol.urlList.map(async (baseUrl) => {
      const url = joinUrl(baseUrl, 'UczenDziennik.mvc/Get').toString();
      const response = await this.requestWithAutoLogin(
        () => this.post<Response<DiaryListData>>(url),
      );
      const data = handleResponse(response);
      return {
        baseUrl,
        data,
      };
    }));
    return results.flatMap(({ data, baseUrl }) => data.map((dataItem) => {
      const info = mapDiaryInfo(dataItem);
      const serialized = {
        info,
        baseUrl,
        host: this.host,
      };
      return ({
        serialized,
        createDiary: (): Diary => new Diary(this, serialized),
      });
    }));
  }

  public async getLuckyNumbers(): Promise<LuckyNumber[]> {
    const response = await this.requestWithAutoLogin(
      () => {
        if (!this.symbol) throw new UnknownSymbolError();
        return this.post<Response<HomepageData>>(luckyNumbersUrl(this.host, this.symbol.value));
      },
    );
    const data = handleResponse(response);
    return mapLuckyNumbers(data);
  }

  public async getReportingUnits(): Promise<ReportingUnit[]> {
    const response = await this.requestWithAutoLogin(
      () => {
        if (!this.symbol) throw new UnknownSymbolError();
        const url = reportingUnitsUrl(this.host, this.symbol.value);
        return this.get<Response<ReportingUnitData>>(url);
      },
    );
    const data = handleResponse(response);
    return mapReportingUnits(data);
  }
}
