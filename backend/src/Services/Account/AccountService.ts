import Logger from '../Logging/Logger';
import axios from 'axios';
import qs from 'qs';
import { InternalServerError, Unauthorized } from "@curveball/http-errors";

export default class AccountService {
    authConfig;


    constructor() {
        const keycloakAuthConfig = {
            clientId: 'star_vote_web',
            responseType: 'code',
            endpoints: {
                login: `${process.env.KEYCLOAK_URL}/auth`,
                logout: `${process.env.KEYCLOAK_URL}/logout`,
                token: `${process.env.KEYCLOAK_URL}/token`,
                authorize: `${process.env.KEYCLOAK_URL}/auth`,
                userinfo: `${process.env.KEYCLOAK_URL}/userinfo`
            },
        }
        this.authConfig = keycloakAuthConfig;
    }

    getToken = async (req: any) => {
        var params: any = {
            grant_type: req.query.grant_type,
            client_id: this.authConfig.clientId,
            redirect_uri: req.query.redirect_uri,
        };
        Logger.debug(req, params);

        // either refresh_token, or authorization_code
        if (req.query.hasOwnProperty('code')) {
            params.code = req.query.code;
        } else {
            // TODO: I should probably be validating the refresh tokens, possibly using the express-jwt library
            //          https://github.com/auth0/express-jwt
            // Github Issue: https://github.com/Equal-Vote/star-server/issues/21
            params.refresh_token = req.cookies.refresh_token;
        }

        Logger.debug(req, `GET TOKEN ${params.grant_type}`);
        try {
            const response = await axios.post(
                this.authConfig.endpoints.token,
                qs.stringify(params),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${Buffer.from(`${this.authConfig.clientId}:${process.env.KEYCLOAK_SECRET}`).toString('base64')}`
                    }
                }
            )
            Logger.debug(req, "success!");
            return response.data
        } catch (err: any) {
            Logger.error(req, 'Error while requesting a token', err.response.data);
            throw new InternalServerError("Error requesting token");
        };
    }
}