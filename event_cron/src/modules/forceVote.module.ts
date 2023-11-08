import arbiterationModel from "../models/arbiteration.model";
import { BN, BN_ONE } from "@polkadot/util";
import type { WeightV2 } from '@polkadot/types/interfaces'
import { Keyring } from "@polkadot/api";
import { WsProvider } from "@polkadot/rpc-provider";
import { ApiPromise } from "@polkadot/api";
import { Abi, ContractPromise } from "@polkadot/api-contract";
import config from "../config/configLocal";
import VoteAbi from "../utils/abi/voteABI.json";
import escrowAbi from "../utils/abi/escrow.json";
import postsModel from "../models/posts.model";
import { RESPONSES, RES_MSG } from "../constant/response";
class Pools {
  constructor() {
    // Bind the selectArbitors method to the current instance of Selection
    this.checkPosts = this.checkPosts.bind(this);
  }
  public async checkPosts() {
    const timeNow: any = Date.now();
    const responce: any = await arbiterationModel.find({
      forceVoteDeadline: { $lt: timeNow },
      isForceVoted: false ,
    });
    if (responce.length > 0) {
      for (let i = 0; i < responce.length; i++) {
        let postData : any = await postsModel.findOne({voteID: responce[i].voteID})
        if(postData.status != "FAILED" && postData.status != "IN_PROGRESS"){
        let req: any = await this.forceVote(responce[i].voteID);
        let hiercut = await this.getPollInfo(responce[i].voteID)
        let response1 = await this.getPaymentInfo(responce[i].currentAuditId);
        let newOfferAmount = await this.removeCommas(String(response1.newOfferAmount))
        let response: any
        if(response1.status == "AuditExpired" || response1.status == "AuditCompleted" ){
          response = await postsModel.findOneAndUpdate(
           { 
             postID: responce[i].postID 
           },
           {
             $set: {
               status: response1.status == "AuditExpired"? "FAILED" : "COMPLETED"
             }
           },
           {
             returnOriginal: false
           }
           ); 
              if(!response){
                return {
                  message: RES_MSG.BADREQUEST,
                  status: RESPONSES.BADREQUEST,
                  error: true
                }
              }
           await this.distribute(String(responce[i].voteID), String(((Number(await this.to18DecimalPrecision(response.offerAmount)) - newOfferAmount) * 95) / 100))
         }
         else{
          let oldData : any = await postsModel.findOne({postID: responce[i].postID})
             response = await postsModel.findOneAndUpdate(
             { 
               postID: responce[i].postID 
             },
             {
               $set: {
                 status: "IN_PROGRESS",
                 offerAmount: await this.from18DecimalPrecision(await this.removeCommas(response1.newOfferAmount)),
                 estimatedDelivery: await this.removeCommas(response1.newDeadline)
               }
             },
             {
               returnOriginal: false
             }
             );
             let dummy = oldData?.offerAmount;
             let Amount = await this.removeCommas(String(response1.newOfferAmount))
             let _as = await this.getArbitersShare()
             let formula =
               (Number((await this.to18DecimalPrecision((dummy)))) -
                 Amount) *
               (Number(_as) / (Number(_as) + Number(hiercut))) *
               (95 / 100);
             await this.distribute(String(responce[i].voteID), String(formula))
         }
        await arbiterationModel.findOneAndUpdate(
          {
            currentAuditId: responce[i].currentAuditId,
          },
          {
            $set: {
              isForceVoted: true,
            },
          }
        );
      }
      }
    }
  }




  private async forceVote(currentPostID: Number) {
    const keyring = new Keyring({type: 'sr25519', ss58Format: 2})
    const wsProvider = new WsProvider("wss://rpc.shibuya.astar.network");
    const api :any = await ApiPromise.create({ provider: wsProvider });
    const privateKey : any= config.SECRET_KEY
    const senderPair = keyring.addFromUri(privateKey);
    const webSocketUrl: any = config.WEB_SOCKET;
    const abi: any = new Abi(VoteAbi, api.registry.getChainProperties());
    const voting: any = config.VOTE_CONTRACT;
    const contract: any = new ContractPromise(api, abi, voting.toString());
    const gasLimit = api.registry.createType(
      "WeightV2",
      await api.consts.system.blockWeights["maxBlock"]
    );

    const { gasRequired } = await contract?.query?.forceVote(
      senderPair.address,
      {
        gasLimit: gasLimit,
      },
      currentPostID
    );
    console.log(gasRequired.toHuman());

    const eventResults: any = await new Promise(async (resolve) => {
      contract?.tx
        ?.forceVote({ gasLimit: gasRequired }, currentPostID)
        .signAndSend(
          senderPair,
          async ({ events = [], status }: { events: any; status: any }) => {
            if (status.isInBlock) {
              for (const { event, phase } of events) {
                if (api.events.contracts.ContractEmitted.is(event)) {
                  const [account_id, contract_evt] = event.data;
                  const res: any = await this.getDecodedEvent(contract_evt);
                  resolve(res);
                }
              }
            } else if (status.isFinalized) {
              console.log("Finalized block hash", status.asFinalized.toHex());
              resolve([]);
            }
          }
        );
    });

    return eventResults;
  }

  private async getPaymentInfo(currentPostID: Number) {
    const keyring = new Keyring({type: 'sr25519', ss58Format: 2})
    const wsProvider = new WsProvider("wss://rpc.shibuya.astar.network");
    const api :any = await ApiPromise.create({ provider: wsProvider });
    const privateKey : any= config.SECRET_KEY
    const senderPair = keyring.addFromUri(privateKey);
    const webSocketUrl: any = config.WEB_SOCKET;
    const storageDepositLimit = null
    const abi: any = new Abi(escrowAbi, api.registry.getChainProperties());
    const escrow: any = config.ESCROW_CONTRACT;
    const contract: any = new ContractPromise(api, abi, escrow.toString());
    const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);
    const PROOFSIZE = new BN(1_000_000);
    const { output } = await contract.query.getPaymentinfo(
    senderPair.address,
    {
      gasLimit: api?.registry.createType('WeightV2', {
        refTime: MAX_CALL_WEIGHT,
        proofSize: PROOFSIZE,
      }) as WeightV2,
      storageDepositLimit
    },
    currentPostID);
    let x = output.toHuman();
    let obj = {
      newDeadline: x.Ok.deadline,
      newOfferAmount: x.Ok.value,
      status: x.Ok.currentstatus
    }
    return obj;
  }

  private async getArbitersShare() {
    const keyring = new Keyring({type: 'sr25519', ss58Format: 2})
    const wsProvider = new WsProvider("wss://rpc.shibuya.astar.network");
    const api :any = await ApiPromise.create({ provider: wsProvider });
    const privateKey : any= config.SECRET_KEY
    const senderPair = keyring.addFromUri(privateKey);
    const webSocketUrl: any = config.WEB_SOCKET;
    const storageDepositLimit = null
    const abi: any = new Abi(VoteAbi, api.registry.getChainProperties());
    const voting: any = config.VOTE_CONTRACT;
    const contract: any = new ContractPromise(api, abi, voting.toString());
    const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);
    const PROOFSIZE = new BN(1_000_000);
    const { output } = await contract.query.knowArbitersShare(
    senderPair.address,
    {
      gasLimit: api?.registry.createType('WeightV2', {
        refTime: MAX_CALL_WEIGHT,
        proofSize: PROOFSIZE,
      }) as WeightV2,
      storageDepositLimit
    });
    let x = output.toHuman();
    return x.Ok;
  }

  private async getPollInfo(currentPostID: Number) {
    const keyring = new Keyring({type: 'sr25519', ss58Format: 2})
    const wsProvider = new WsProvider("wss://rpc.shibuya.astar.network");
    const api :any = await ApiPromise.create({ provider: wsProvider });
    const privateKey : any= config.SECRET_KEY
    const senderPair = keyring.addFromUri(privateKey);
    const webSocketUrl: any = config.WEB_SOCKET;
    const storageDepositLimit = null
    const abi: any = new Abi(VoteAbi, api.registry.getChainProperties());
    const voting: any = config.VOTE_CONTRACT;
    const contract: any = new ContractPromise(api, abi, voting.toString());
    const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);
    const PROOFSIZE = new BN(1_000_000);
    const { output } = await contract.query.getPollInfo(
    senderPair.address,
    {
      gasLimit: api?.registry.createType('WeightV2', {
        refTime: MAX_CALL_WEIGHT,
        proofSize: PROOFSIZE,
      }) as WeightV2,
      storageDepositLimit
    },
    currentPostID);
    let x = output.toHuman();
    return x.Ok.decidedHaircut;
  }

  private async distribute(currentPostID: String, Dividend : String) {
    const keyring = new Keyring({type: 'sr25519', ss58Format: 2})
    const wsProvider = new WsProvider("wss://rpc.shibuya.astar.network");
    const api :any = await ApiPromise.create({ provider: wsProvider });
    const privateKey : any= config.SECRET_KEY
    const senderPair = keyring.addFromUri(privateKey);
    const webSocketUrl: any = config.WEB_SOCKET;
    const abi: any = new Abi(VoteAbi, api.registry.getChainProperties());
    const voting: any = config.VOTE_CONTRACT;
    const contract: any = new ContractPromise(api, abi, voting.toString());
    const gasLimit = api.registry.createType(
      "WeightV2",
      await api.consts.system.blockWeights["maxBlock"]
    );
    const { gasRequired } = await contract?.query?.releaseTreasuryFunds(
      senderPair.address,
      {
        gasLimit: gasLimit,
      },
      currentPostID,
      Dividend
    );
    const eventResults: any = await new Promise(async (resolve) => {
      contract?.tx
        ?.releaseTreasuryFunds({ gasLimit: gasRequired }, currentPostID, Dividend)
        .signAndSend(
          senderPair,
          async ({ events = [], status }: { events: any; status: any }) => {
            if (status.isInBlock) {
              for (const { event, phase } of events) {
                if (api.events.contracts.ContractEmitted.is(event)) {
                  const [account_id, contract_evt] = event.data;
                  const res: any = await this.getDecodedEvent(contract_evt);
                  resolve(res);
                }
              }
            } else if (status.isFinalized) {
              console.log("Finalized block hash", status.asFinalized.toHex());
              resolve([]);
            }
          }
        );
    });
    return eventResults;
  }

  private async removeCommas(input: string) {
    // Remove commas from the input string and parse it as a number
    const stringWithoutCommas = input.replace(/,/g, '');
    const numberValue = parseFloat(stringWithoutCommas);
    // Check if the parsing was successful
    if (!isNaN(numberValue)) {
      return numberValue;
    } else {
      throw new Error('Invalid input format');
    }
  }

  private async to18DecimalPrecision(input: any) {
    const precision = 18;
    const output = (input * Math.pow(10, precision)).toFixed(precision);
    return output.split(".")[0];
  }
  private async from18DecimalPrecision(input: any) {
    const precision = 18;
    const num = parseFloat(input) / Math.pow(10, precision);
    return num;
  }
  private async removeMilliseconds(timestamp: any) {
    return Math.floor(timestamp / 1000);
  }

  getDecodedEvent(event: any) {
    try {
      const decoded = new Abi(escrowAbi).decodeEvent(event);
      return decoded.args;
    } catch (err) {
      console.log("");
    }
  }
}
export default new Pools();