import { Test, TestingModule } from '@nestjs/testing';
import { ConciergeController } from './concierge.controller';

describe('ConciergeController', () => {
  let controller: ConciergeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConciergeController],
    }).compile();

    controller = module.get<ConciergeController>(ConciergeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
