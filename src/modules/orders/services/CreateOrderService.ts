import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('could not find any customer with the given id');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts.length) {
      throw new AppError('could not find products with the given ids');
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    const checkInexistenProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistenProducts.length) {
      throw new AppError(
        `could not find product(s) ${checkInexistenProducts
          .map(product => product.id)
          .join(', ')}`,
      );
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    console.log(findProductsWithNoQuantityAvailable);

    if (findProductsWithNoQuantityAvailable.length) {
      const errorMessages = findProductsWithNoQuantityAvailable.map(
        product =>
          `the quantity ${product.quantity} is not available for ${product.id}`,
      );

      throw new AppError(errorMessages.join(', '));
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
