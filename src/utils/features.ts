import { ref } from 'vue';
import { getSystemFeatures } from '../api/player';

export const aiEnabled = ref(false);

export const initFeatures = async () => {
  try {
    const res = await getSystemFeatures();
    aiEnabled.value = res.ai_enabled;
  } catch (error) {
    console.error('Failed to fetch system features:', error);
    aiEnabled.value = false;
  }
};
