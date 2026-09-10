import React from 'react';
import Image from 'next/image';
import { CloseIcon, IconButton } from './ui/IconButton';
import { Overlay } from './ui/Overlay';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Overlay labelledBy="donation-title" onClose={onClose} panelClassName="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl sm:w-full md:max-w-md">
      <div className="p-3 sm:p-6">
        <div className="mb-3 flex items-center justify-between sm:mb-5">
          <h3 id="donation-title" className="flex items-center bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text font-serif text-lg font-bold italic text-transparent sm:text-xl" style={{ fontFamily: "'Brush Script MT', cursive, serif" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8h1a2 2 0 0 1 2 2v1c0 1.1-.9 2-2 2h-1" fill="#f9a8d4" />
              <path d="M6 8h12v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8z" fill="#f9a8d4" />
              <path d="M6 8V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1" fill="#f472b6" />
              <path d="M12 16v-4" stroke="#7d2a5a" />
              <path d="M9.5 14.5L9 16" stroke="#7d2a5a" />
              <path d="M14.5 14.5L15 16" stroke="#7d2a5a" />
            </svg>
            Buy Me A Milk Tea
          </h3>
          <IconButton aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="text-center">
          <p className="mb-3 break-words text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            开源项目是把作者和用户紧紧联系在一起的社群，如果您希望这个项目继续发展，可以请作者喝一杯奶茶。
          </p>
          <p className="mb-4 break-words text-sm text-gray-600 dark:text-gray-300 sm:mb-6 sm:text-base">
            您的支持是作者把项目继续下去的动力。
          </p>
          <div className="mb-4 flex justify-center sm:mb-5">
            <div className="relative h-40 w-40 rounded-lg bg-gradient-to-r from-pink-100 to-rose-100 p-1 shadow-md dark:from-pink-900/30 dark:to-rose-900/30 sm:h-48 sm:w-48 sm:p-2 md:h-56 md:w-56">
              <Image
                src="/donation-qr.jpg"
                alt="赞赏码"
                fill
                className="object-contain p-1 sm:p-2"
              />
            </div>
          </div>
          <p className="inline-block rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-500 shadow-sm dark:bg-gray-700 dark:text-gray-300 sm:px-4 sm:py-2 sm:text-sm">
            微信扫描上方赞赏码，请作者喝一杯奶茶。
          </p>
        </div>
      </div>
    </Overlay>
  );
};

export default DonationModal;
