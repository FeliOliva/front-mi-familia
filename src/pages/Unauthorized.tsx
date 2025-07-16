import React from 'react';
import { useTranslation } from 'react-i18next';

const Unauthorized = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold text-red-600">{t('unauthorized.title')}</h1>
      <p className="mt-4 text-lg text-gray-700">{t('unauthorized.message')}</p>
    </div>
  );
};

export default Unauthorized;
