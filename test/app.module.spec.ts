import { Test } from '@nestjs/testing';
import { parseCorsOrigin } from '../src/app.configure';
import { AppModule } from '../src/app.module';

describe('AppModule', () => {
  it('compiles the Phase 1 backend modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('allows both localhost aliases for the Vite dev server by default', () => {
    expect(parseCorsOrigin()).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });
});
