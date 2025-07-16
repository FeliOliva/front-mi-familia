import { LoadingOutlined } from '@ant-design/icons';
import { Flex, Spin } from 'antd';
const Loading = () => (
      <Flex justify="center" style={{ height: '100vh', marginTop: '20%' }}>
    <Spin
      indicator={
        <LoadingOutlined
          style={{
            fontSize: 48
          }}
          spin
        />
      }
    />
  </Flex>
);
export default Loading; 