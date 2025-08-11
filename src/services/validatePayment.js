const validatePayment = async (order) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      newRegistration,
    } = order;
    const sha = crypto.createHmac("sha256", "oqmyqcRZJf5OxCx6DOLXR2G8");
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      throw new ApiErrors(400, "Transaction Failed...!");
    }
  
    //   const payment = await Payment.create({
    //     registrationId: newRegistration._id,
    //     razorpayOrderId: razorpay_order_id,
    //     razorpayPaymentId: razorpay_payment_id,
    //     razorpaySignature: razorpay_signature,
    //     status: "success",
    //     amount: amount,
    //   });
  
    //   const registration = await Registration.findByIdAndUpdate(
    //     newRegistration._id,
    //     {
    //       $set: {
    //         payment: payment._id,
    //         isPaymentSuccessful: true,
    //       },
    //     }
    return {status : true, order:order};
  };
  
  export default validatePayment;