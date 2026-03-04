/**
 * Login OAuth DTO.
 * access_token must be the raw JWT string from GoTrue (e.g. from URL hash after OAuth redirect).
 * Do NOT base64-encode the token when sending.
 */
export class LoginOAuthDto {
  access_token: string;
}
