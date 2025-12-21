---
updateTime: '2025-12-21 18:26'
tags: Java
---
- AMQP风格(允许多个消费者共同消费同一个队列，并且处理和确认消息是破坏性的操作)
 ![](/minio/weblog/b5c2ba9dbfda467bb57cf17736999e28.png)

  RabbitMq

- 日志风格
  - kafka
 
  ![](/minio/weblog/35697757d9f347949df14b5ae05054ff.png)

    + 高吞吐
        + 双线程
          + 主线程负责创建消息、调用拦截器、序列化消息、把消息放到累加器
          + sender线程负责从累加器获取**批次的消息**发送到broker(16k/1s发送)
        + 分区设计
          + 轮询、粘性、hash
        + 零拷贝
        + 顺序写
        + 消息压缩(默认不压缩)

  - rocketMq
  ![](/minio/weblog/f00eb8ede3f549af903d3ca5cb2c0140.png)
架构：
![](/minio/weblog/6dd16e58db8e4f85b1a27434f5d9e4da.png)


  
