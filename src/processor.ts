import * as balanceHandlers from "./handlers"
import * as ss58 from "@subsquid/ss58"

import { EventHandlerContext, Store, SubstrateProcessor } from "@subsquid/substrate-processor"

const processor = new SubstrateProcessor('polkadot_balances')


processor.setTypesBundle('polkadot')
processor.setBatchSize(500)


processor.setDataSource({
    archive: 'https://polkadot.indexer.gc.subsquid.io/v4/graphql',
    chain: 'wss://rpc.polkadot.io'
})


processor.addEventHandler('balances.Endowed', balanceHandlers.handleEndowedEvent)
processor.addEventHandler('balances.DustLost', balanceHandlers.handleDustLostEvent)
processor.addEventHandler('balances.Transfer', balanceHandlers.handleTransferEvent)
processor.addEventHandler('balances.BalanceSet', balanceHandlers.handleBalanceSetEvent)
processor.addEventHandler('balances.Reserved', balanceHandlers.handleReservedEvent)
processor.addEventHandler('balances.Unreserved', balanceHandlers.handleUnreservedEvent)
processor.addEventHandler('balances.ReserveRepatriated', balanceHandlers.handleReserveRepatriatedEvent)
processor.addEventHandler('balances.Deposit', balanceHandlers.handleDepositEvent)
processor.addEventHandler('balances.Withdraw', balanceHandlers.handleWithdrawEvent)
processor.addEventHandler('balances.Slashed', balanceHandlers.handleSlashedEvent)


processor.run()


async function getOrCreate<T extends { id: string }>(
    store: Store,
    entityConstructor: EntityConstructor<T>,
    id: string
): Promise<T> {

    let e = await store.get<T>(entityConstructor, {
        where: { id },
    })

    if (e == null) {
        e = new entityConstructor()
        e.id = id
    }

    return e
}


type EntityConstructor<T> = {
    new(...args: any[]): T
}
