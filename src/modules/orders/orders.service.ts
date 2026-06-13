import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PackStatus,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';

type Money = InstanceType<typeof Prisma.Decimal>;

type LoadedRecommendationResult = NonNullable<
  Awaited<ReturnType<OrdersService['loadRecommendationResult']>>
>;

interface PricedOrderItem {
  packId: string;
  productId: string;
  productReferenceId: string;
  productNameSnapshot: string;
  referenceNameSnapshot: string;
  unitPriceSnapshot: Money;
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

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    const recommendationResult = await this.loadRecommendationResult(
      createOrderDto.recommendationResultId,
    );

    if (!recommendationResult) {
      throw new NotFoundException(
        `Recommendation result ${createOrderDto.recommendationResultId} was not found.`,
      );
    }

    this.validateRecommendationResult(recommendationResult);

    const priceSummary = this.calculateOrderPrice(recommendationResult);
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
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
          unitPriceSnapshot: item.unitPriceSnapshot,
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
      };
    });

    return this.toOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      pack: recommendationResult.pack,
      items: priceSummary.items,
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
      packName: order.selectedPack.name,
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
            unitPriceSnapshot: true,
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

  private async loadRecommendationResult(recommendationResultId: string) {
    return this.prisma.recommendationResult.findUnique({
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
                isActive: true,
                status: true,
              },
            },
            selectedProductReference: {
              select: {
                id: true,
                referenceCode: true,
                referenceName: true,
                priceOverride: true,
                priceDelta: true,
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
        item.selectedProductReference.stockQuantity <=
          item.selectedProductReference.reservedQuantity
      ) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(item.selectedProductReference)} is out of stock.`,
        );
      }
    }
  }

  private async upsertCustomer(
    tx: Prisma.TransactionClient,
    createOrderDto: CreateOrderDto,
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
        unitPriceSnapshot: unitPrice,
        quantity,
        totalPrice: unitPrice.times(quantity),
      };
    });

    const itemSubtotal = itemSnapshots.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      zero,
    );

    if (recommendationResult.pack.priceMode === PriceMode.FIXED) {
      if (!recommendationResult.pack.fixedPrice) {
        throw new BadRequestException('Selected pack has no fixed price.');
      }

      const subtotalAmount = this.decimal(recommendationResult.pack.fixedPrice);

      return {
        subtotalAmount,
        discountAmount: zero,
        deliveryFee: zero,
        totalAmount: subtotalAmount,
        items: itemSnapshots,
      };
    }

    if (recommendationResult.pack.priceMode === PriceMode.SUM_ITEMS) {
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
      recommendationResult.pack.discountAmount,
      recommendationResult.pack.discountPercentage,
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
    if (item.selectedProductReference.priceOverride) {
      return this.decimal(item.selectedProductReference.priceOverride);
    }

    return this.decimal(item.product.basePrice).plus(
      item.selectedProductReference.priceDelta,
    );
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
        quantity: item.quantity,
        unitPrice: this.toNumber(item.unitPriceSnapshot),
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
        quantity: item.quantity,
        unitPrice: toMoneyNumber(item.unitPriceSnapshot),
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
