import { UnauthorizedException } from '@nestjs/common';

import { WebsocketGateway } from './websocket.gateway';
import { AuthService } from '../modules/auth/auth.service';

type HandshakeShape = {
  auth?: { token?: unknown };
  headers?: { authorization?: string };
};

function makeClient(handshake: HandshakeShape = {}) {
  return {
    id: 'sock-1',
    handshake: {
      auth: handshake.auth ?? {},
      headers: handshake.headers ?? {},
    },
    data: {} as Record<string, unknown>,
    disconnect: jest.fn(),
  };
}

function makeGateway(auth: Partial<AuthService>) {
  return new WebsocketGateway(auth as AuthService);
}

describe('WebsocketGateway.handleConnection', () => {
  it('accepts a socket whose handshake carries a valid JWT', () => {
    const verify = jest.fn().mockReturnValue({
      sub: 'user-1',
      tid: 'tenant-1',
      email: 'user@acme.dev',
    });
    const gateway = makeGateway({ verify });
    const client = makeClient({ auth: { token: 'valid.jwt.token' } });

    gateway.handleConnection(client as never);

    expect(verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@acme.dev',
    });
  });

  it('accepts a socket whose token is supplied via Authorization: Bearer header', () => {
    const verify = jest.fn().mockReturnValue({
      sub: 'user-2',
      tid: 'tenant-2',
      email: 'manager@acme.dev',
    });
    const gateway = makeGateway({ verify });
    const client = makeClient({ headers: { authorization: 'Bearer header.jwt.token' } });

    gateway.handleConnection(client as never);

    expect(verify).toHaveBeenCalledWith('header.jwt.token');
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data.userId).toBe('user-2');
  });

  it('rejects the socket when no token is present', () => {
    const verify = jest.fn();
    const gateway = makeGateway({ verify });
    const client = makeClient();

    gateway.handleConnection(client as never);

    expect(verify).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data).toEqual({});
  });

  it('rejects the socket when verification throws', () => {
    const verify = jest.fn(() => {
      throw new UnauthorizedException('invalid');
    });
    const gateway = makeGateway({ verify });
    const client = makeClient({ auth: { token: 'bad.jwt.token' } });

    gateway.handleConnection(client as never);

    expect(verify).toHaveBeenCalledWith('bad.jwt.token');
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data).toEqual({});
  });

  it('ignores non-string tokens on the handshake', () => {
    const verify = jest.fn();
    const gateway = makeGateway({ verify });
    const client = makeClient({ auth: { token: 12345 } });

    gateway.handleConnection(client as never);

    expect(verify).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
