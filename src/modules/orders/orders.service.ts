import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
  OrderStatus,
  PackItemRole,
  PackStatus,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  BuildPackConfigurationSnapshotInput,
  buildPackConfigurationSnapshot,
} from '../../common/utils/pack-configuration-snapshot.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { isPackAvailableNow } from '../packs/pack-availability.util';
import {
  ConfigurationAddOnInput,
  ConfigurationItemInput,
  ValidatorPack,
  validatePackConfiguration,
} from '../packs/pack-configuration.validator';
import { CreateCartOrderDto } from './dto/create-cart-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePackOrderDto } from './dto/create-pack-order.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { OrderStockService } from './order-stock.service';

type Money = InstanceType<typeof Prisma.Decimal>;

type LoadedRecommendationResult = NonNullable<
  Awaited<ReturnType<OrdersService['loadRecommendationResult']>>
>;

type LoadedFixedPurchasePack = NonNullable<
  Awaited<ReturnType<OrdersService['loadFixedPurchasePack']>>
>;

type LoadedFixedPackItem = LoadedFixedPurchasePack['items'][number];
type LoadedFixedPackReference =
  LoadedFixedPackItem['product']['references'][number];

type LoadedConfigurationCheckout = NonNullable<
  Awaited<ReturnType<OrdersService['loadConfigurationForCheckout']>>
>;
type LoadedConfigurationPack = LoadedConfigurationCheckout['sourcePack'];
type LoadedConfigurationProduct =
  LoadedConfigurationPack['items'][number]['product'];

/** One selected/removed/added line accepted by the snapshot builder. */
type SnapshotLine = NonNullable<
  BuildPackConfigurationSnapshotInput['selectedItems']
>[number];

interface PricedOrderItem {
  packId: string | null;
  productId: string;
  productReferenceId: string;
  productNameSnapshot: string;
  referenceNameSnapshot: string;
  skuSnapshot: string | null;
  variationSnapshot: string | null;
  productImageUrlSnapshot: string | null;
  brandNameSnapshot: string | null;
  unitPriceSnapshot: Money;
  originalUnitPriceSnapshot: Money | null;
  quantity: number;
  totalPrice: Money;
}

interface PriceSummary {
  subtotalAmount: Money;
  discountAmount: Money;
  deliveryFee: Money;
  totalAmount: Money;
  items: PricedOrderItem[];
}

interface CartPriceSummary extends PriceSummary {
  currency: string;
}

interface CustomerOrderInput {
  fullName: string;
  phone: string;
  whatsappPhone?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStockService: OrderStockService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const recommendationResult = await this.loadRecommendationResult(
        createOrderDto.recommendationResultId,
        tx,
      );

      if (!recommendationResult) {
        throw new NotFoundException(
          `Recommendation result ${createOrderDto.recommendationResultId} was not found.`,
        );
      }

      this.validateRecommendationResult(recommendationResult);
      const priceSummary = this.calculateOrderPrice(recommendationResult);
      await this.orderStockService.reserveForNewOrder(tx, priceSummary.items);

      const customer = await this.upsertCustomer(tx, createOrderDto);

      await tx.customerAddress.updateMany({
        where: {
          customerId: customer.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          city: createOrderDto.city,
          addressLine: createOrderDto.addressLine,
          extraInfo: createOrderDto.extraInfo || null,
          isDefault: true,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerProfileId:
            recommendationResult.recommendationSession.customerProfile.id,
          recommendationResultId: recommendationResult.id,
          selectedPackId: recommendationResult.packId,
          customerAddressId: address.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.UNPAID,
          orderStatus: OrderStatus.PENDING_CONFIRMATION,
          subtotalAmount: priceSummary.subtotalAmount,
          discountAmount: priceSummary.discountAmount,
          deliveryFee: priceSummary.deliveryFee,
          totalAmount: priceSummary.totalAmount,
          currency: recommendationResult.pack.currency,
          notes: createOrderDto.notes || null,
        },
      });

      await tx.orderItem.createMany({
        data: priceSummary.items.map((item) => ({
          orderId: order.id,
          packId: item.packId,
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          productNameSnapshot: item.productNameSnapshot,
          referenceNameSnapshot: item.referenceNameSnapshot,
          skuSnapshot: item.skuSnapshot,
          variationSnapshot: item.variationSnapshot,
          productImageUrlSnapshot: item.productImageUrlSnapshot,
          brandNameSnapshot: item.brandNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          originalUnitPriceSnapshot: item.originalUnitPriceSnapshot,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        })),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING_CONFIRMATION,
          comment: 'Order created',
        },
      });

      await tx.recommendationResult.update({
        where: { id: recommendationResult.id },
        data: { isSelected: true },
      });

      return {
        order,
        customer,
        address,
        pack: recommendationResult.pack,
        items: priceSummary.items,
      };
    });

    return this.toOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      pack: created.pack,
      items: created.items,
    });
  }

  async createFromCart(dto: CreateCartOrderDto) {
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const priceSummary = await this.calculateCartOrderPrice(dto, tx);
      await this.orderStockService.reserveForNewOrder(tx, priceSummary.items);

      const customer = await this.upsertCustomer(tx, dto);

      await tx.customerAddress.updateMany({
        where: {
          customerId: customer.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          city: dto.city,
          addressLine: dto.addressLine,
          extraInfo: dto.extraInfo || null,
          isDefault: true,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerProfileId: null,
          recommendationResultId: null,
          selectedPackId: null,
          customerAddressId: address.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.UNPAID,
          orderStatus: OrderStatus.PENDING_CONFIRMATION,
          subtotalAmount: priceSummary.subtotalAmount,
          discountAmount: priceSummary.discountAmount,
          deliveryFee: priceSummary.deliveryFee,
          totalAmount: priceSummary.totalAmount,
          currency: priceSummary.currency,
          notes: dto.notes || null,
        },
      });

      await tx.orderItem.createMany({
        data: priceSummary.items.map((item) => ({
          orderId: order.id,
          packId: item.packId,
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          productNameSnapshot: item.productNameSnapshot,
          referenceNameSnapshot: item.referenceNameSnapshot,
          skuSnapshot: item.skuSnapshot,
          variationSnapshot: item.variationSnapshot,
          productImageUrlSnapshot: item.productImageUrlSnapshot,
          brandNameSnapshot: item.brandNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          originalUnitPriceSnapshot: item.originalUnitPriceSnapshot,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        })),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING_CONFIRMATION,
          comment: 'Order created',
        },
      });

      return {
        order,
        customer,
        address,
        items: priceSummary.items,
      };
    });

    return this.toCartOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      items: created.items,
    });
  }

  /**
   * Pack Core Evolution (Phase 4B) — direct Cash-on-Delivery purchase of a
   * single fixed, non-customizable Pack as one unit.
   *
   * The Pack is loaded, validated (active, available, non-customizable, no
   * required-selectable / customer-choice slots), and expanded server-side into
   * normal priced OrderItems (each carrying `packId`). The Pack's own price mode
   * is applied through the shared {@link applyPackPriceMode} helper and stock is
   * reserved through the existing atomic {@link OrderStockService.reserveForNewOrder}
   * flow. No client-supplied item or price is ever trusted. The customer /
   * address / order-line snapshot logic is the same as the other order paths.
   * `packConfigurationSnapshot` stays null in this phase.
   */
  async createFromFixedPack(packId: string, dto: CreatePackOrderDto) {
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const pack = await this.loadFixedPurchasePack(packId, tx);

      if (!pack) {
        throw new NotFoundException(`Pack ${packId} was not found.`);
      }

      this.validateFixedPurchasePack(pack);

      const itemSnapshots = this.buildFixedPackItemSnapshots(pack);
      const priceSummary = this.applyPackPriceMode(pack, itemSnapshots);
      await this.orderStockService.reserveForNewOrder(tx, priceSummary.items);

      const customer = await this.upsertCustomer(tx, dto);

      await tx.customerAddress.updateMany({
        where: {
          customerId: customer.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          city: dto.city,
          addressLine: dto.addressLine,
          extraInfo: dto.extraInfo || null,
          isDefault: true,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerProfileId: null,
          recommendationResultId: null,
          selectedPackId: pack.id,
          customerAddressId: address.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.UNPAID,
          orderStatus: OrderStatus.PENDING_CONFIRMATION,
          subtotalAmount: priceSummary.subtotalAmount,
          discountAmount: priceSummary.discountAmount,
          deliveryFee: priceSummary.deliveryFee,
          totalAmount: priceSummary.totalAmount,
          currency: pack.currency,
          notes: dto.notes || null,
        },
      });

      await tx.orderItem.createMany({
        data: priceSummary.items.map((item) => ({
          orderId: order.id,
          packId: item.packId,
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          productNameSnapshot: item.productNameSnapshot,
          referenceNameSnapshot: item.referenceNameSnapshot,
          skuSnapshot: item.skuSnapshot,
          variationSnapshot: item.variationSnapshot,
          productImageUrlSnapshot: item.productImageUrlSnapshot,
          brandNameSnapshot: item.brandNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          originalUnitPriceSnapshot: item.originalUnitPriceSnapshot,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        })),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING_CONFIRMATION,
          comment: 'Order created',
        },
      });

      return {
        order,
        customer,
        address,
        pack,
        items: priceSummary.items,
      };
    });

    return this.toOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      pack: created.pack,
      items: created.items,
    });
  }

  /**
   * Pack Core Evolution (Phase 6) — configured Cash-on-Delivery checkout from a
   * previously persisted {@link PackConfiguration}.
   *
   * The configuration is loaded with its immutable stored composition and its
   * source Pack (current state). The stored selections are **revalidated** with
   * the same Phase 5 validator (stock, price, allowed composition, and price
   * floor are re-checked against the live Pack) — a stale, unavailable,
   * disallowed, or below-floor configuration is rejected before any order is
   * created and no stock is reserved. On success the configuration is expanded
   * into normal priced OrderItems (each carrying `packId`), stock is reserved
   * through the existing atomic flow, and the order freezes an immutable
   * {@link buildPackConfigurationSnapshot} on `Order.packConfigurationSnapshot`.
   * Prices are always server-recomputed; no client price is ever trusted.
   */
  async createFromConfiguration(configurationId: string, dto: CreatePackOrderDto) {
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const configuration = await this.loadConfigurationForCheckout(
        configurationId,
        tx,
      );

      if (!configuration) {
        throw new NotFoundException(
          `Pack configuration ${configurationId} was not found.`,
        );
      }

      const pack = configuration.sourcePack;

      if (!pack.isActive || pack.status !== PackStatus.ACTIVE) {
        throw new BadRequestException('The pack is inactive or archived.');
      }

      if (!pack.isCustomizable) {
        throw new BadRequestException(
          'The source pack is no longer customizable.',
        );
      }

      // Revalidate the stored selections against the current pack state.
      const input = this.reconstructConfigurationInput(
        pack,
        configuration.items,
      );
      const result = validatePackConfiguration(
        this.toConfigurationValidatorPack(pack),
        input,
      );

      if (!result.isValid) {
        throw new BadRequestException({
          message:
            'The saved configuration is no longer valid and cannot be ordered.',
          validationErrors: result.validationErrors,
        });
      }

      const lines = this.buildConfiguredOrderLines(pack, result);
      const priceSummary = this.summarizeConfiguredPrice(
        result,
        lines.pricedItems,
      );
      await this.orderStockService.reserveForNewOrder(tx, priceSummary.items);

      const snapshot = buildPackConfigurationSnapshot({
        sourcePackId: pack.id,
        sourcePackName: pack.name,
        sourceType: 'CUSTOMIZED',
        currency: pack.currency,
        finalPrice: result.computedPrice,
        minAllowedPrice: result.minAllowedPrice,
        selectedItems: lines.snapshotSelected,
        removedItems: lines.snapshotRemoved,
        addedItems: lines.snapshotAdded,
      });

      const customer = await this.upsertCustomer(tx, dto);

      await tx.customerAddress.updateMany({
        where: { customerId: customer.id, isDefault: true },
        data: { isDefault: false },
      });

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          city: dto.city,
          addressLine: dto.addressLine,
          extraInfo: dto.extraInfo || null,
          isDefault: true,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerProfileId: null,
          recommendationResultId: null,
          selectedPackId: pack.id,
          packConfigurationId: configuration.id,
          customerAddressId: address.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.UNPAID,
          orderStatus: OrderStatus.PENDING_CONFIRMATION,
          subtotalAmount: priceSummary.subtotalAmount,
          discountAmount: priceSummary.discountAmount,
          deliveryFee: priceSummary.deliveryFee,
          totalAmount: priceSummary.totalAmount,
          currency: pack.currency,
          notes: dto.notes || null,
          packConfigurationSnapshot:
            snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.orderItem.createMany({
        data: priceSummary.items.map((item) => ({
          orderId: order.id,
          packId: item.packId,
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          productNameSnapshot: item.productNameSnapshot,
          referenceNameSnapshot: item.referenceNameSnapshot,
          skuSnapshot: item.skuSnapshot,
          variationSnapshot: item.variationSnapshot,
          productImageUrlSnapshot: item.productImageUrlSnapshot,
          brandNameSnapshot: item.brandNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          originalUnitPriceSnapshot: item.originalUnitPriceSnapshot,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        })),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING_CONFIRMATION,
          comment: 'Order created',
        },
      });

      return {
        order,
        customer,
        address,
        pack,
        items: priceSummary.items,
      };
    });

    return this.toOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      pack: created.pack,
      items: created.items,
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        orderStatus: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        selectedPack: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: this.toNumber(order.totalAmount),
      currency: order.currency,
      packName: order.selectedPack?.name ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async adminFindAll(query: QueryAdminOrdersDto) {
    this.validateAdminQuery(query);
    const pagination = paginationParams(query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const where = this.buildAdminWhere(query);

    const [orders, totalItems] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ [sortBy]: sortOrder }],
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentMethod: true,
          paymentStatus: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          customerAddress: {
            select: {
              city: true,
            },
          },
          selectedPack: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginatedResponse(
      orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        totalAmount: toMoneyNumber(order.totalAmount),
        currency: order.currency,
        customer: order.customer,
        address: {
          city: order.customerAddress.city,
        },
        pack: order.selectedPack,
        itemCount: order._count.items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      { ...pagination, totalItems },
    );
  }

  async adminFindOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        subtotalAmount: true,
        discountAmount: true,
        deliveryFee: true,
        totalAmount: true,
        currency: true,
        notes: true,
        packConfigurationSnapshot: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            whatsappPhone: true,
            email: true,
          },
        },
        customerAddress: {
          select: {
            id: true,
            city: true,
            addressLine: true,
            extraInfo: true,
            isDefault: true,
          },
        },
        customerProfile: {
          select: {
            id: true,
            sourceChannel: true,
          },
        },
        selectedPack: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        recommendationResult: {
          select: {
            id: true,
            rank: true,
            totalScore: true,
            matchPercentage: true,
          },
        },
        items: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            productId: true,
            productReferenceId: true,
            productNameSnapshot: true,
            referenceNameSnapshot: true,
            skuSnapshot: true,
            variationSnapshot: true,
            productImageUrlSnapshot: true,
            brandNameSnapshot: true,
            unitPriceSnapshot: true,
            originalUnitPriceSnapshot: true,
            quantity: true,
            totalPrice: true,
          },
        },
        statusHistory: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            oldStatus: true,
            newStatus: true,
            comment: true,
            createdAt: true,
            changedByAdmin: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    return this.toAdminDetailResponse(order);
  }

  private async loadRecommendationResult(
    recommendationResultId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.recommendationResult.findUnique({
      where: { id: recommendationResultId },
      select: {
        id: true,
        packId: true,
        pack: {
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            priceMode: true,
            fixedPrice: true,
            discountAmount: true,
            discountPercentage: true,
            currency: true,
          },
        },
        recommendationSession: {
          select: {
            customerProfile: {
              select: {
                id: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                compareAtPrice: true,
                mainImageUrl: true,
                isActive: true,
                status: true,
                brand: {
                  select: {
                    name: true,
                  },
                },
                images: {
                  where: { role: MediaRole.COVER },
                  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
                  take: 1,
                  select: {
                    media: {
                      select: {
                        secureUrl: true,
                        url: true,
                      },
                    },
                  },
                },
              },
            },
            selectedProductReference: {
              select: {
                id: true,
                referenceCode: true,
                referenceName: true,
                shadeName: true,
                measurement: true,
                sku: true,
                priceOverride: true,
                priceDelta: true,
                imageUrl: true,
                image: {
                  select: {
                    media: {
                      select: {
                        secureUrl: true,
                        url: true,
                      },
                    },
                  },
                },
                stockQuantity: true,
                reservedQuantity: true,
                isActive: true,
              },
            },
            packItem: {
              select: {
                isRequired: true,
              },
            },
          },
        },
      },
    });
  }

  private validateRecommendationResult(
    recommendationResult: LoadedRecommendationResult,
  ) {
    if (recommendationResult.items.length === 0) {
      throw new BadRequestException(
        'Recommendation result has no selected items.',
      );
    }

    if (
      !recommendationResult.pack.isActive ||
      recommendationResult.pack.status !== PackStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'The selected pack is inactive or archived.',
      );
    }

    for (const item of recommendationResult.items) {
      if (
        !item.product.isActive ||
        item.product.status !== ProductStatus.ACTIVE
      ) {
        throw new BadRequestException(
          `Selected product ${item.product.name} is no longer active.`,
        );
      }

      if (!item.selectedProductReference.isActive) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(item.selectedProductReference)} is no longer active.`,
        );
      }

      if (
        item.packItem.isRequired &&
        item.selectedProductReference.stockQuantity -
          item.selectedProductReference.reservedQuantity <
          item.quantity
      ) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(item.selectedProductReference)} is out of stock.`,
        );
      }
    }
  }

  private async upsertCustomer(
    tx: Prisma.TransactionClient,
    createOrderDto: CustomerOrderInput,
  ) {
    const existingCustomer = await tx.customer.findUnique({
      where: { phone: createOrderDto.phone },
    });

    if (existingCustomer) {
      return tx.customer.update({
        where: { id: existingCustomer.id },
        data: {
          fullName: createOrderDto.fullName,
          whatsappPhone:
            createOrderDto.whatsappPhone || existingCustomer.whatsappPhone,
        },
      });
    }

    return tx.customer.create({
      data: {
        fullName: createOrderDto.fullName,
        phone: createOrderDto.phone,
        whatsappPhone: createOrderDto.whatsappPhone || null,
      },
    });
  }

  private async calculateCartOrderPrice(
    dto: CreateCartOrderDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<CartPriceSummary> {
    if (!dto.items?.length) {
      throw new BadRequestException('Cart must contain at least one item.');
    }

    const requestedQuantityByReference = new Map<string, number>();

    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException('Cart item quantity must be at least 1.');
      }

      requestedQuantityByReference.set(
        item.referenceId,
        (requestedQuantityByReference.get(item.referenceId) ?? 0) +
          item.quantity,
      );
    }

    const zero = this.decimal(0);
    const pricedItems: PricedOrderItem[] = [];
    let currency: string | null = null;

    for (const item of dto.items) {
      const product = await client.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          basePrice: true,
          compareAtPrice: true,
          mainImageUrl: true,
          currency: true,
          isActive: true,
          status: true,
          brand: {
            select: {
              name: true,
            },
          },
          images: {
            where: { role: MediaRole.COVER },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            take: 1,
            select: {
              media: {
                select: {
                  secureUrl: true,
                  url: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} was not found.`);
      }

      if (!product.isActive || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(
          `Product ${product.name} is not active or sellable.`,
        );
      }

      const reference = await client.productReference.findUnique({
        where: { id: item.referenceId },
        select: {
          id: true,
          productId: true,
          referenceCode: true,
          referenceName: true,
          shadeName: true,
          measurement: true,
          sku: true,
          priceOverride: true,
          priceDelta: true,
          imageUrl: true,
          image: {
            select: {
              media: {
                select: {
                  secureUrl: true,
                  url: true,
                },
              },
            },
          },
          stockQuantity: true,
          reservedQuantity: true,
          isActive: true,
        },
      });

      if (!reference) {
        throw new NotFoundException(
          `Reference ${item.referenceId} was not found.`,
        );
      }

      if (reference.productId !== product.id) {
        throw new BadRequestException(
          'Selected reference does not belong to the selected product.',
        );
      }

      if (!reference.isActive) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(reference)} is no longer active.`,
        );
      }

      const requestedQuantity =
        requestedQuantityByReference.get(reference.id) ?? item.quantity;

      if (
        reference.stockQuantity - reference.reservedQuantity <
        requestedQuantity
      ) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(reference)} does not have enough stock.`,
        );
      }

      if (currency && currency !== product.currency) {
        throw new BadRequestException('Cart items must use the same currency.');
      }
      currency = product.currency;

      const unitPrice = this.effectiveProductReferencePrice(product, reference);

      pricedItems.push({
        packId: null,
        productId: product.id,
        productReferenceId: reference.id,
        productNameSnapshot: product.name,
        referenceNameSnapshot: this.referenceSnapshotName(reference),
        skuSnapshot: reference.sku,
        variationSnapshot: this.variationSnapshot(reference),
        productImageUrlSnapshot: this.snapshotImageUrl(product, reference),
        brandNameSnapshot: product.brand?.name ?? null,
        unitPriceSnapshot: unitPrice,
        originalUnitPriceSnapshot: this.originalUnitPriceSnapshot(
          product,
          unitPrice,
        ),
        quantity: item.quantity,
        totalPrice: unitPrice.times(item.quantity),
      });
    }

    const subtotalAmount = pricedItems.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      zero,
    );
    const discountAmount = zero;
    const deliveryFee = this.deliveryFeeForCity(dto.city);
    const totalAmount = subtotalAmount.plus(deliveryFee).minus(discountAmount);

    return {
      subtotalAmount,
      discountAmount,
      deliveryFee,
      totalAmount,
      currency: currency ?? 'MAD',
      items: pricedItems,
    };
  }

  private calculateOrderPrice(
    recommendationResult: LoadedRecommendationResult,
  ): PriceSummary {
    const zero = this.decimal(0);
    const itemSnapshots = recommendationResult.items.map((item) => {
      const unitPrice = this.effectiveReferencePrice(item);
      const quantity = item.quantity;

      return {
        packId: recommendationResult.packId,
        productId: item.product.id,
        productReferenceId: item.selectedProductReference.id,
        productNameSnapshot: item.product.name,
        referenceNameSnapshot: this.referenceSnapshotName(
          item.selectedProductReference,
        ),
        skuSnapshot: item.selectedProductReference.sku,
        variationSnapshot: this.variationSnapshot(
          item.selectedProductReference,
        ),
        productImageUrlSnapshot: this.snapshotImageUrl(
          item.product,
          item.selectedProductReference,
        ),
        brandNameSnapshot: item.product.brand?.name ?? null,
        unitPriceSnapshot: unitPrice,
        originalUnitPriceSnapshot: this.originalUnitPriceSnapshot(
          item.product,
          unitPrice,
        ),
        quantity,
        totalPrice: unitPrice.times(quantity),
      };
    });

    return this.applyPackPriceMode(recommendationResult.pack, itemSnapshots);
  }

  /**
   * Applies a Pack's price mode to already-priced line snapshots. Shared by the
   * recommendation-funnel order path and the direct fixed-Pack purchase path so
   * both compute `FIXED` / `SUM_ITEMS` / `SUM_ITEMS_WITH_DISCOUNT` identically.
   * Prices are always derived server-side from the line snapshots and the Pack's
   * own pricing fields — never from any client input.
   */
  private applyPackPriceMode(
    pack: {
      priceMode: PriceMode;
      fixedPrice: Prisma.Decimal | null;
      discountAmount: Prisma.Decimal | null;
      discountPercentage: Prisma.Decimal | null;
    },
    itemSnapshots: PricedOrderItem[],
  ): PriceSummary {
    const zero = this.decimal(0);
    const itemSubtotal = itemSnapshots.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      zero,
    );

    if (pack.priceMode === PriceMode.FIXED) {
      if (!pack.fixedPrice) {
        throw new BadRequestException('Selected pack has no fixed price.');
      }

      const subtotalAmount = this.decimal(pack.fixedPrice);

      return {
        subtotalAmount,
        discountAmount: zero,
        deliveryFee: zero,
        totalAmount: subtotalAmount,
        items: itemSnapshots,
      };
    }

    if (pack.priceMode === PriceMode.SUM_ITEMS) {
      return {
        subtotalAmount: itemSubtotal,
        discountAmount: zero,
        deliveryFee: zero,
        totalAmount: itemSubtotal,
        items: itemSnapshots,
      };
    }

    const discountAmount = this.calculateDiscount(
      itemSubtotal,
      pack.discountAmount,
      pack.discountPercentage,
    );
    const totalAmount = Prisma.Decimal.max(
      itemSubtotal.minus(discountAmount),
      zero,
    );

    return {
      subtotalAmount: itemSubtotal,
      discountAmount,
      deliveryFee: zero,
      totalAmount,
      items: itemSnapshots,
    };
  }

  /**
   * Loads a Pack with everything needed to expand it into priced order lines:
   * its pricing fields, its items (role / selection mode / quantity), and each
   * item's product + product references (for reference resolution, pricing,
   * snapshots, and availability).
   */
  private loadFixedPurchasePack(
    packId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.pack.findUnique({
      where: { id: packId },
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        isCustomizable: true,
        priceMode: true,
        fixedPrice: true,
        discountAmount: true,
        discountPercentage: true,
        currency: true,
        items: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            role: true,
            selectionMode: true,
            quantity: true,
            productReferenceId: true,
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                compareAtPrice: true,
                mainImageUrl: true,
                isActive: true,
                status: true,
                brand: {
                  select: {
                    name: true,
                  },
                },
                images: {
                  where: { role: MediaRole.COVER },
                  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
                  take: 1,
                  select: {
                    media: {
                      select: {
                        secureUrl: true,
                        url: true,
                      },
                    },
                  },
                },
                references: {
                  orderBy: [{ referenceCode: 'asc' }, { createdAt: 'asc' }],
                  select: {
                    id: true,
                    referenceCode: true,
                    referenceName: true,
                    shadeName: true,
                    measurement: true,
                    sku: true,
                    priceOverride: true,
                    priceDelta: true,
                    imageUrl: true,
                    image: {
                      select: {
                        media: {
                          select: {
                            secureUrl: true,
                            url: true,
                          },
                        },
                      },
                    },
                    stockQuantity: true,
                    reservedQuantity: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Guards the direct fixed-Pack purchase path. Only active, available,
   * non-customizable Packs whose items are all fixed (no required-selectable or
   * customer-choice slots) may be bought as one unit in this phase.
   */
  private validateFixedPurchasePack(pack: LoadedFixedPurchasePack) {
    if (!pack.isActive || pack.status !== PackStatus.ACTIVE) {
      throw new BadRequestException('The pack is inactive or archived.');
    }

    if (pack.isCustomizable) {
      throw new BadRequestException(
        'Customizable packs cannot be purchased directly. Use the pack configuration flow.',
      );
    }

    for (const item of pack.items) {
      if (
        item.role === PackItemRole.REQUIRED_SELECTABLE ||
        item.selectionMode === SelectionMode.CUSTOMER_CHOICE
      ) {
        throw new BadRequestException(
          'This pack requires customer selections and cannot be purchased as a fixed pack.',
        );
      }
    }

    if (!isPackAvailableNow(this.toFixedPurchaseAvailabilityPack(pack))) {
      throw new BadRequestException(
        'The pack is not available for purchase right now.',
      );
    }
  }

  /**
   * Maps the loaded pack onto the pure availability shape. A pinned
   * FIXED_REFERENCE item is satisfied only by that reference; other items may be
   * satisfied by any of the product's active in-stock references.
   */
  private toFixedPurchaseAvailabilityPack(pack: LoadedFixedPurchasePack) {
    return {
      status: pack.status,
      isActive: pack.isActive,
      items: pack.items.map((item) => {
        const fixedReference =
          item.selectionMode === SelectionMode.FIXED_REFERENCE
            ? (item.product.references.find(
                (reference) => reference.id === item.productReferenceId,
              ) ?? null)
            : null;

        return {
          role: item.role,
          quantity: item.quantity,
          fixedReference,
          candidateReferences: item.product.references,
        };
      }),
    };
  }

  /**
   * Expands the fixed items of a Pack into priced order-line snapshots. Only
   * `FIXED`-role items form the fixed pack composition (this exactly matches the
   * availability blocking set once required-selectable items are rejected), so a
   * Pack deemed available always reserves cleanly. Each item resolves to one
   * concrete reference server-side.
   */
  private buildFixedPackItemSnapshots(
    pack: LoadedFixedPurchasePack,
  ): PricedOrderItem[] {
    const fixedItems = pack.items.filter(
      (item) => item.role === PackItemRole.FIXED,
    );

    if (fixedItems.length === 0) {
      throw new BadRequestException('The pack has no purchasable items.');
    }

    return fixedItems.map((item) => {
      const product = item.product;
      const reference = this.resolveFixedPackReference(item);
      const unitPrice = this.effectiveProductReferencePrice(product, reference);

      return {
        packId: pack.id,
        productId: product.id,
        productReferenceId: reference.id,
        productNameSnapshot: product.name,
        referenceNameSnapshot: this.referenceSnapshotName(reference),
        skuSnapshot: reference.sku,
        variationSnapshot: this.variationSnapshot(reference),
        productImageUrlSnapshot: this.snapshotImageUrl(product, reference),
        brandNameSnapshot: product.brand?.name ?? null,
        unitPriceSnapshot: unitPrice,
        originalUnitPriceSnapshot: this.originalUnitPriceSnapshot(
          product,
          unitPrice,
        ),
        quantity: item.quantity,
        totalPrice: unitPrice.times(item.quantity),
      };
    });
  }

  /**
   * Resolves the single concrete reference used for a fixed pack item. A
   * FIXED_REFERENCE item uses its pinned reference; an AUTO_BEST_REFERENCE item
   * uses the first active, in-stock reference in the product's deterministic
   * (referenceCode) order. Availability was validated beforehand, so a missing
   * usable reference is treated as a hard error.
   */
  private resolveFixedPackReference(
    item: LoadedFixedPackItem,
  ): LoadedFixedPackReference {
    const product = item.product;

    if (item.selectionMode === SelectionMode.FIXED_REFERENCE) {
      const reference = product.references.find(
        (candidate) =>
          candidate.id === item.productReferenceId &&
          candidate.isActive &&
          this.availableReferenceStock(candidate) >= item.quantity,
      );

      if (!reference) {
        throw new BadRequestException(
          `Fixed reference for product ${product.name} is inactive or out of stock.`,
        );
      }

      return reference;
    }

    const reference = product.references.find(
      (candidate) =>
        candidate.isActive &&
        this.availableReferenceStock(candidate) >= item.quantity,
    );

    if (!reference) {
      throw new BadRequestException(
        `Product ${product.name} has no active in-stock reference.`,
      );
    }

    return reference;
  }

  /**
   * Loads a persisted PackConfiguration together with its immutable stored
   * composition and the current state of its source Pack — everything needed to
   * revalidate the configuration and to expand it into priced order lines with
   * full product/reference snapshots.
   */
  private loadConfigurationForCheckout(
    configurationId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const referenceSelect = {
      id: true,
      referenceCode: true,
      referenceName: true,
      shadeName: true,
      measurement: true,
      sku: true,
      priceOverride: true,
      priceDelta: true,
      imageUrl: true,
      image: {
        select: { media: { select: { secureUrl: true, url: true } } },
      },
      stockQuantity: true,
      reservedQuantity: true,
      isActive: true,
    } satisfies Prisma.ProductReferenceSelect;

    const productSelect = {
      id: true,
      name: true,
      basePrice: true,
      compareAtPrice: true,
      mainImageUrl: true,
      isActive: true,
      status: true,
      brand: { select: { name: true } },
      images: {
        where: { role: MediaRole.COVER },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        select: { media: { select: { secureUrl: true, url: true } } },
      },
      references: {
        orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
        select: referenceSelect,
      },
    } satisfies Prisma.ProductSelect;

    return client.packConfiguration.findUnique({
      where: { id: configurationId },
      select: {
        id: true,
        items: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            packItemId: true,
            productId: true,
            productReferenceId: true,
            role: true,
            quantity: true,
            isAddOn: true,
            removed: true,
          },
        },
        sourcePack: {
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            isCustomizable: true,
            priceMode: true,
            discountAmount: true,
            discountPercentage: true,
            currency: true,
            minAllowedPrice: true,
            minRequiredItems: true,
            maxItemCount: true,
            items: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                role: true,
                selectionMode: true,
                quantity: true,
                minQuantity: true,
                maxQuantity: true,
                quantityEditable: true,
                removalAllowed: true,
                replacementAllowed: true,
                productReferenceId: true,
                product: { select: productSelect },
                allowedReferences: { select: { productReferenceId: true } },
              },
            },
            allowedAddOns: {
              select: {
                productId: true,
                productReferenceId: true,
                product: { select: productSelect },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Reconstructs the original validator input from a persisted configuration's
   * normalized items, using the *current* Pack items to decide when a stored
   * reference represents a customer selection/replacement (which must be replayed
   * through the gating rules) versus a server auto-resolved reference (which the
   * validator re-resolves). This keeps revalidation faithful without ever
   * trusting a stored price.
   */
  private reconstructConfigurationInput(
    pack: LoadedConfigurationPack,
    configItems: LoadedConfigurationCheckout['items'],
  ): { items: ConfigurationItemInput[]; addOns: ConfigurationAddOnInput[] } {
    const packItemsById = new Map(pack.items.map((item) => [item.id, item]));
    const items: ConfigurationItemInput[] = [];
    const addOns: ConfigurationAddOnInput[] = [];

    for (const stored of configItems) {
      if (stored.isAddOn) {
        addOns.push({
          productId: stored.productId,
          productReferenceId: stored.productReferenceId ?? undefined,
          quantity: stored.quantity,
        });
        continue;
      }

      if (!stored.packItemId) {
        continue;
      }

      if (stored.removed) {
        items.push({ packItemId: stored.packItemId, removed: true });
        continue;
      }

      const entry: ConfigurationItemInput = {
        packItemId: stored.packItemId,
        quantity: stored.quantity,
      };

      const packItem = packItemsById.get(stored.packItemId);
      const isRequiredSelectable =
        packItem?.role === PackItemRole.REQUIRED_SELECTABLE;
      const isExplicitReference =
        !packItem ||
        isRequiredSelectable ||
        (stored.productReferenceId != null &&
          stored.productReferenceId !== packItem.productReferenceId);

      if (isExplicitReference && stored.productReferenceId != null) {
        entry.productReferenceId = stored.productReferenceId;
      }

      items.push(entry);
    }

    return { items, addOns };
  }

  /** Maps a loaded configuration Pack onto the pure validator input shape. */
  private toConfigurationValidatorPack(
    pack: LoadedConfigurationPack,
  ): ValidatorPack {
    const toRefs = (references: LoadedConfigurationProduct['references']) =>
      references.map((reference) => ({
        id: reference.id,
        isActive: reference.isActive,
        stockQuantity: reference.stockQuantity,
        reservedQuantity: reference.reservedQuantity,
        priceOverride: reference.priceOverride,
        priceDelta: reference.priceDelta,
      }));

    return {
      id: pack.id,
      priceMode: pack.priceMode,
      discountAmount: pack.discountAmount,
      discountPercentage: pack.discountPercentage,
      currency: pack.currency,
      minAllowedPrice: pack.minAllowedPrice,
      minRequiredItems: pack.minRequiredItems,
      maxItemCount: pack.maxItemCount,
      items: pack.items.map((item) => ({
        id: item.id,
        role: item.role,
        selectionMode: item.selectionMode,
        quantity: item.quantity,
        minQuantity: item.minQuantity,
        maxQuantity: item.maxQuantity,
        quantityEditable: item.quantityEditable,
        removalAllowed: item.removalAllowed,
        replacementAllowed: item.replacementAllowed,
        productReferenceId: item.productReferenceId,
        product: {
          id: item.product.id,
          name: item.product.name,
          basePrice: item.product.basePrice,
          isActive: item.product.isActive,
          status: item.product.status,
          references: toRefs(item.product.references),
        },
        allowedReferenceIds: item.allowedReferences.map(
          (allowed) => allowed.productReferenceId,
        ),
      })),
      allowedAddOns: pack.allowedAddOns.map((addOn) => ({
        productId: addOn.productId,
        productReferenceId: addOn.productReferenceId,
        product: {
          id: addOn.product.id,
          name: addOn.product.name,
          basePrice: addOn.product.basePrice,
          isActive: addOn.product.isActive,
          status: addOn.product.status,
          references: toRefs(addOn.product.references),
        },
      })),
    };
  }

  /**
   * Expands a revalidated configuration into priced order lines (one per kept
   * item, each carrying `packId`) plus the selected/removed/added snapshot lines
   * for the immutable order snapshot. Product/reference snapshot fields come from
   * the freshly loaded Pack; unit prices come from the validator (server-side).
   */
  private buildConfiguredOrderLines(
    pack: LoadedConfigurationPack,
    result: ReturnType<typeof validatePackConfiguration>,
  ) {
    const packItemsById = new Map(pack.items.map((item) => [item.id, item]));
    const pricedItems: PricedOrderItem[] = [];
    const snapshotSelected: SnapshotLine[] = [];
    const snapshotRemoved: SnapshotLine[] = [];
    const snapshotAdded: SnapshotLine[] = [];

    for (const normalized of result.normalizedItems) {
      if (normalized.removed) {
        const packItem = normalized.packItemId
          ? packItemsById.get(normalized.packItemId)
          : undefined;
        snapshotRemoved.push({
          productId: normalized.productId,
          productReferenceId: null,
          productName: packItem?.product.name ?? normalized.productId,
          referenceName: null,
          role:
            packItem?.role ??
            (normalized.role as PackItemRole),
          quantity: 0,
          unitPrice: 0,
        });
        continue;
      }

      const resolved = this.resolveConfiguredLineSource(pack, normalized);
      const { product, reference } = resolved;
      const unitPrice = this.decimal(normalized.unitPrice);

      pricedItems.push({
        packId: pack.id,
        productId: product.id,
        productReferenceId: reference.id,
        productNameSnapshot: product.name,
        referenceNameSnapshot: this.referenceSnapshotName(reference),
        skuSnapshot: reference.sku,
        variationSnapshot: this.variationSnapshot(reference),
        productImageUrlSnapshot: this.snapshotImageUrl(product, reference),
        brandNameSnapshot: product.brand?.name ?? null,
        unitPriceSnapshot: unitPrice,
        originalUnitPriceSnapshot: this.originalUnitPriceSnapshot(
          product,
          unitPrice,
        ),
        quantity: normalized.quantity,
        totalPrice: unitPrice.times(normalized.quantity),
      });

      const snapshotLine: SnapshotLine = {
        productId: product.id,
        productReferenceId: reference.id,
        productName: product.name,
        referenceName: this.referenceSnapshotName(reference),
        role: normalized.isAddOn
          ? PackItemRole.OPTIONAL_ADDON
          : (normalized.role as PackItemRole),
        quantity: normalized.quantity,
        unitPrice: normalized.unitPrice,
      };

      if (normalized.isAddOn) {
        snapshotAdded.push(snapshotLine);
      } else {
        snapshotSelected.push(snapshotLine);
      }
    }

    return { pricedItems, snapshotSelected, snapshotRemoved, snapshotAdded };
  }

  /**
   * Resolves the concrete product + reference backing one normalized line from
   * the loaded Pack. Post-validation these always exist; a miss is a hard error.
   */
  private resolveConfiguredLineSource(
    pack: LoadedConfigurationPack,
    normalized: ReturnType<
      typeof validatePackConfiguration
    >['normalizedItems'][number],
  ): {
    product: LoadedConfigurationProduct;
    reference: LoadedConfigurationProduct['references'][number];
  } {
    const product = normalized.isAddOn
      ? pack.allowedAddOns.find(
          (addOn) => addOn.productId === normalized.productId,
        )?.product
      : normalized.packItemId
        ? pack.items.find((item) => item.id === normalized.packItemId)?.product
        : undefined;

    const reference = product?.references.find(
      (ref) => ref.id === normalized.productReferenceId,
    );

    if (!product || !reference) {
      throw new BadRequestException(
        'The saved configuration references a product or reference that no longer exists.',
      );
    }

    return { product, reference };
  }

  /**
   * Derives the order price summary for a configured checkout. The validated
   * `computedPrice` (already discount-applied and floor-checked by the validator)
   * is authoritative for the total; the discount is the difference from the
   * pre-discount line subtotal.
   */
  private summarizeConfiguredPrice(
    result: ReturnType<typeof validatePackConfiguration>,
    pricedItems: PricedOrderItem[],
  ): PriceSummary {
    const zero = this.decimal(0);
    const subtotal = pricedItems.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      zero,
    );
    const total = this.decimal(result.computedPrice);
    const discount = Prisma.Decimal.max(subtotal.minus(total), zero);

    return {
      subtotalAmount: subtotal,
      discountAmount: discount,
      deliveryFee: zero,
      totalAmount: total,
      items: pricedItems,
    };
  }

  private availableReferenceStock(reference: {
    stockQuantity: number;
    reservedQuantity?: number | null;
  }): number {
    return Math.max(
      reference.stockQuantity - (reference.reservedQuantity ?? 0),
      0,
    );
  }

  private calculateDiscount(
    itemSubtotal: Money,
    discountAmount: Prisma.Decimal | null,
    discountPercentage: Prisma.Decimal | null,
  ): Money {
    if (discountAmount) {
      return Prisma.Decimal.min(this.decimal(discountAmount), itemSubtotal);
    }

    if (discountPercentage) {
      const percentage = this.decimal(discountPercentage);
      const calculated = itemSubtotal.times(percentage).div(100);
      return Prisma.Decimal.min(calculated, itemSubtotal);
    }

    return this.decimal(0);
  }

  private effectiveReferencePrice(
    item: LoadedRecommendationResult['items'][number],
  ): Money {
    return this.effectiveProductReferencePrice(
      item.product,
      item.selectedProductReference,
    );
  }

  private effectiveProductReferencePrice(
    product: { basePrice: Prisma.Decimal },
    reference: {
      priceOverride: Prisma.Decimal | null;
      priceDelta: Prisma.Decimal;
    },
  ): Money {
    if (reference.priceOverride) {
      return this.decimal(reference.priceOverride);
    }

    return this.decimal(product.basePrice).plus(reference.priceDelta);
  }

  private originalUnitPriceSnapshot(
    product: { compareAtPrice?: Prisma.Decimal | null },
    unitPrice: Money,
  ): Money | null {
    if (!product.compareAtPrice) {
      return null;
    }

    const originalPrice = this.decimal(product.compareAtPrice);
    return originalPrice.gt(unitPrice) ? originalPrice : null;
  }

  private variationSnapshot(reference: {
    referenceName: string;
    shadeName?: string | null;
    measurement?: string | null;
  }): string | null {
    const parts = [reference.shadeName, reference.measurement].filter(
      Boolean,
    ) as string[];

    return parts.length > 0 ? parts.join(' / ') : reference.referenceName;
  }

  private snapshotImageUrl(
    product: {
      mainImageUrl?: string | null;
      images?: { media: { secureUrl: string; url?: string | null } }[];
    },
    reference: {
      imageUrl?: string | null;
      image?: { media: { secureUrl: string; url?: string | null } } | null;
    },
  ): string | null {
    return (
      reference.image?.media.secureUrl ??
      reference.image?.media.url ??
      reference.imageUrl ??
      product.images?.[0]?.media.secureUrl ??
      product.images?.[0]?.media.url ??
      product.mainImageUrl ??
      null
    );
  }

  private deliveryFeeForCity(_city: string): Money {
    return this.decimal(0);
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
    const randomPart = crypto
      .randomUUID()
      .replaceAll('-', '')
      .slice(0, 6)
      .toUpperCase();

    return `ORD-${datePart}-${randomPart}`;
  }

  private toOrderResponse(input: {
    order: {
      id: string;
      orderNumber: string;
      orderStatus: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      deliveryFee: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      currency: string;
    };
    customer: {
      fullName: string;
      phone: string;
    };
    address: {
      city: string;
      addressLine: string;
    };
    pack: {
      id: string;
      name: string;
    };
    items: PricedOrderItem[];
  }) {
    return {
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      orderStatus: input.order.orderStatus,
      paymentMethod: input.order.paymentMethod,
      paymentStatus: input.order.paymentStatus,
      subtotalAmount: this.toNumber(input.order.subtotalAmount),
      discountAmount: this.toNumber(input.order.discountAmount),
      deliveryFee: this.toNumber(input.order.deliveryFee),
      totalAmount: this.toNumber(input.order.totalAmount),
      currency: input.order.currency,
      customer: {
        fullName: input.customer.fullName,
        phone: input.customer.phone,
      },
      address: {
        city: input.address.city,
        addressLine: input.address.addressLine,
      },
      pack: {
        id: input.pack.id,
        name: input.pack.name,
      },
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productNameSnapshot,
        referenceId: item.productReferenceId,
        referenceName: item.referenceNameSnapshot,
        sku: item.skuSnapshot,
        variation: item.variationSnapshot,
        imageUrl: item.productImageUrlSnapshot,
        brandName: item.brandNameSnapshot,
        quantity: item.quantity,
        unitPrice: this.toNumber(item.unitPriceSnapshot),
        originalUnitPrice:
          item.originalUnitPriceSnapshot != null
            ? this.toNumber(item.originalUnitPriceSnapshot)
            : null,
        totalPrice: this.toNumber(item.totalPrice),
      })),
    };
  }

  private toCartOrderResponse(input: {
    order: {
      id: string;
      orderNumber: string;
      orderStatus: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      deliveryFee: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      currency: string;
    };
    customer: {
      fullName: string;
      phone: string;
    };
    address: {
      city: string;
      addressLine: string;
    };
    items: PricedOrderItem[];
  }) {
    return {
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      orderStatus: input.order.orderStatus,
      paymentMethod: input.order.paymentMethod,
      paymentStatus: input.order.paymentStatus,
      subtotalAmount: this.toNumber(input.order.subtotalAmount),
      discountAmount: this.toNumber(input.order.discountAmount),
      deliveryFee: this.toNumber(input.order.deliveryFee),
      totalAmount: this.toNumber(input.order.totalAmount),
      currency: input.order.currency,
      customer: {
        fullName: input.customer.fullName,
        phone: input.customer.phone,
      },
      address: {
        city: input.address.city,
        addressLine: input.address.addressLine,
      },
      pack: null,
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productNameSnapshot,
        referenceId: item.productReferenceId,
        referenceName: item.referenceNameSnapshot,
        sku: item.skuSnapshot,
        variation: item.variationSnapshot,
        imageUrl: item.productImageUrlSnapshot,
        brandName: item.brandNameSnapshot,
        quantity: item.quantity,
        unitPrice: this.toNumber(item.unitPriceSnapshot),
        originalUnitPrice:
          item.originalUnitPriceSnapshot != null
            ? this.toNumber(item.originalUnitPriceSnapshot)
            : null,
        totalPrice: this.toNumber(item.totalPrice),
      })),
    };
  }

  private referenceSnapshotName(reference: {
    referenceCode: string;
    referenceName: string;
  }): string {
    return `${reference.referenceCode} ${reference.referenceName}`;
  }

  private decimal(value: Prisma.Decimal.Value): Money {
    return new Prisma.Decimal(value);
  }

  private toNumber(value: Prisma.Decimal): number {
    return value.toNumber();
  }

  private validateAdminQuery(query: QueryAdminOrdersDto) {
    if (
      query.createdFrom &&
      query.createdTo &&
      new Date(query.createdFrom) > new Date(query.createdTo)
    ) {
      throw new BadRequestException('createdFrom cannot be after createdTo.');
    }

    if (
      query.minTotal !== undefined &&
      query.maxTotal !== undefined &&
      query.minTotal > query.maxTotal
    ) {
      throw new BadRequestException(
        'minTotal cannot be greater than maxTotal.',
      );
    }
  }

  private buildAdminWhere(query: QueryAdminOrdersDto): Prisma.OrderWhereInput {
    return {
      ...(query.orderStatus ? { orderStatus: query.orderStatus } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.selectedPackId ? { selectedPackId: query.selectedPackId } : {}),
      ...(query.sourceChannel
        ? { customerProfile: { sourceChannel: query.sourceChannel } }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom
                ? { gte: new Date(query.createdFrom) }
                : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.minTotal !== undefined || query.maxTotal !== undefined
        ? {
            totalAmount: {
              ...(query.minTotal !== undefined ? { gte: query.minTotal } : {}),
              ...(query.maxTotal !== undefined ? { lte: query.maxTotal } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                customer: {
                  fullName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  phone: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private toAdminDetailResponse(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      subtotalAmount: toMoneyNumber(order.subtotalAmount),
      discountAmount: toMoneyNumber(order.discountAmount),
      deliveryFee: toMoneyNumber(order.deliveryFee),
      totalAmount: toMoneyNumber(order.totalAmount),
      currency: order.currency,
      notes: order.notes,
      // Pack Core Evolution (Phase 3) — surface the frozen pack-configuration
      // snapshot only when the order actually carries one. Legacy/non-configured
      // orders omit the field entirely (null snapshot).
      ...(order.packConfigurationSnapshot != null
        ? { packConfigurationSnapshot: order.packConfigurationSnapshot }
        : {}),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: order.customer,
      address: order.customerAddress,
      customerProfile: order.customerProfile,
      pack: order.selectedPack,
      recommendationResult: order.recommendationResult
        ? {
            ...order.recommendationResult,
            matchPercentage: toMoneyNumber(
              order.recommendationResult.matchPercentage,
            ),
          }
        : null,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        referenceId: item.productReferenceId,
        productName: item.productNameSnapshot,
        referenceName: item.referenceNameSnapshot,
        sku: item.skuSnapshot,
        variation: item.variationSnapshot,
        imageUrl: item.productImageUrlSnapshot,
        brandName: item.brandNameSnapshot,
        quantity: item.quantity,
        unitPrice: toMoneyNumber(item.unitPriceSnapshot),
        originalUnitPrice: toMoneyNumber(item.originalUnitPriceSnapshot),
        totalPrice: toMoneyNumber(item.totalPrice),
      })),
      statusHistory: order.statusHistory.map((history: any) => ({
        id: history.id,
        oldStatus: history.oldStatus,
        newStatus: history.newStatus,
        comment: history.comment,
        changedByAdmin: history.changedByAdmin,
        createdAt: history.createdAt,
      })),
    };
  }
}
